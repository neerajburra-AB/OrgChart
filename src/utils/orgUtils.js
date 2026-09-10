// Synthetic id for the "To Be Confirmed / Unknown RM" grouping node created by buildOrgTree
// below. Chosen to be extremely unlikely to collide with a real employee id from the sheet.
export const UNASSIGNED_MANAGER_ID = '__unassigned_rm__';

// Preferred display order for known seniority levels in filter/form dropdowns. A level
// value from the data that isn't in this map (a custom one the live Sheet introduces)
// still shows up - see getUniqueSortedValues below - just sorted after these, alphabetically.
export const LEVEL_RANK = { 'C-Level': 0, 'VP': 1, 'Director': 2, 'Lead': 3, 'Senior': 4, 'Mid': 5 };

// Shared by App.jsx's filter dropdowns and MemberModal's Add/Edit form dropdowns, so both
// always offer exactly the values actually present in the loaded data - never a hardcoded
// list that can silently exclude a real department/level/entity string from the live Sheet.
export function getUniqueSortedValues(members, field, rankMap) {
  const seen = new Set();
  members.forEach((m) => { if (m[field]) seen.add(m[field]); });
  const values = Array.from(seen);
  if (rankMap) {
    return values.sort((a, b) => {
      const rankA = rankMap[a] ?? 999;
      const rankB = rankMap[b] ?? 999;
      if (rankA !== rankB) return rankA - rankB;
      return a.localeCompare(b);
    });
  }
  return values.sort((a, b) => a.localeCompare(b));
}

/**
 * Converts a flat array of org members into a nested tree structure
 */
export function buildOrgTree(members, collapseState = {}) {
  const memberMap = new Map();
  let root = null;

  // Clone objects and add children array
  members.forEach(member => {
    memberMap.set(member.id, {
      ...member,
      children: [],
      directReportsCount: 0,
      totalSubtreeCount: 0,
      isCollapsed: !!collapseState[member.id]
    });
  });

  // Pass 1: pick the root from managerId alone - a person with a genuinely BLANK
  // managerId (no manager at all). A non-blank managerId that doesn't match anyone
  // is a DATA ERROR (typo, deleted manager, bad import/export), not a signal that
  // this person belongs at the top - it must never compete for root, or whichever
  // broken row happens to appear first in the sheet silently becomes "the boss"
  // instead of the actual owner.
  memberMap.forEach(node => {
    if (!node.managerId) {
      if (!root) {
        root = node;
      } else if (node.id !== root.id) {
        // More than one person has a blank managerId (rare, but possible with messy
        // data) - keep the first as the real root and nest the rest under it so
        // nobody is silently dropped.
        root.children.push(node);
      }
    }
  });

  // Pass 2: connect everyone whose managerId points to a real person. Anyone whose
  // managerId is non-blank but doesn't match anyone in the dataset (the data-error
  // case above) is collected as an "orphan" instead of vanishing from the chart -
  // they get grouped under a single synthetic node below rather than dumped as
  // direct reports of the real root (which would misrepresent the org structure).
  const orphanNodes = [];
  memberMap.forEach(node => {
    if (!node.managerId) return; // already placed in pass 1
    const manager = memberMap.get(node.managerId);
    if (manager) {
      manager.children.push(node);
    } else if (root && node.id !== root.id) {
      orphanNodes.push(node);
    }
  });

  if (!root) {
    // Extremely unlikely (every single row has SOME managerId value) - fall back to
    // the first row so the chart still renders something instead of going blank.
    root = memberMap.values().next().value || null;
  }

  // Group every orphan under one clearly-labeled synthetic node ("To Be Confirmed /
  // Unknown RM") attached beneath the root, instead of attaching them directly under
  // the root as if they genuinely reported to the chairman/owner. This keeps the data
  // problem visible and contained in one place rather than scattered across the top
  // of the chart. The orphans' effective managerId is repointed at this synthetic
  // node (their raw data is untouched - `members` is not mutated) so search's
  // ancestor-expansion and other managerId-chain walks resolve correctly for them.
  if (orphanNodes.length > 0 && root) {
    const unassignedGroup = {
      id: UNASSIGNED_MANAGER_ID,
      name: 'To Be Confirmed / Unknown RM',
      title: `${orphanNodes.length} employee(s) with an unrecognized manager ID`,
      department: '',
      email: '',
      phone: '',
      location: '',
      avatar: '',
      status: 'active',
      managerId: root.id,
      matrixManagerId: null,
      skills: [],
      bio: 'Auto-generated group - these employees\' managerId does not match any existing employee id (typo, deleted manager, or bad import/export). Fix their managerId in the data source to place them correctly in the chart.',
      joinDate: '',
      level: '',
      children: orphanNodes,
      directReportsCount: 0,
      totalSubtreeCount: 0,
      isCollapsed: !!collapseState[UNASSIGNED_MANAGER_ID],
      isVirtual: true
    };
    orphanNodes.forEach(o => { o.managerId = UNASSIGNED_MANAGER_ID; });
    memberMap.set(UNASSIGNED_MANAGER_ID, unassignedGroup);
    root.children.push(unassignedGroup);

    if (typeof console !== 'undefined') {
      console.warn(
        `buildOrgTree: ${orphanNodes.length} employee(s) have a managerId that doesn't ` +
        `match any employee id - grouped under a "To Be Confirmed / Unknown RM" node ` +
        `beneath the root. Check those rows for typos or a manager who was removed from the sheet.`
      );
    }
  }

  // Calculate subtree sizes recursively. Guarded against cyclic managerId data (e.g. a
  // row whose managerId - directly or a few hops up - points back to itself) so a bad
  // row can't recurse forever and freeze the tab; it just stops re-counting a node it
  // has already visited.
  const visitedForCounts = new Set();
  function computeSubtreeCounts(node) {
    if (visitedForCounts.has(node.id)) return 0;
    visitedForCounts.add(node.id);
    node.directReportsCount = node.children.length;
    let count = 0;
    node.children.forEach(child => {
      count += 1 + computeSubtreeCounts(child);
    });
    node.totalSubtreeCount = count;
    return count;
  }

  if (root) {
    computeSubtreeCounts(root);
  }

  return { root, memberMap };
}

/**
 * Generalized version of the depth-based "expand root + N levels, collapse the rest"
 * BFS that computeDefaultCollapseState (App.jsx) uses for the real tree - pulled out
 * here so a second, independent root (the Focus view's chosen starting employee, see
 * buildFocusTree below) gets the exact same default-collapse behavior instead of a
 * second hand-rolled copy of this logic. This project has already hit the same bug
 * twice from two independent copies of a BFS like this one drifting apart (see the
 * "To Be Confirmed / Unknown RM" section of the deployment notes) - one shared
 * implementation instead of two is deliberate, not just tidiness.
 *
 * `baseCollapse` seeds the result (e.g. the real tree always starts the synthetic
 * "Unknown RM" node collapsed regardless of depth - App.jsx passes that in here rather
 * than this function knowing about it).
 */
export function computeCollapseStateFromRoot(memberList, rootId, autoExpandDepth = 1, baseCollapse = {}) {
  if (!memberList || memberList.length === 0 || !rootId) return baseCollapse;

  const byId = new Map(memberList.map((m) => [m.id, m]));
  if (!byId.has(rootId)) return baseCollapse;

  const childrenOf = new Map();
  memberList.forEach((m) => {
    if (m.managerId && byId.has(m.managerId)) {
      if (!childrenOf.has(m.managerId)) childrenOf.set(m.managerId, []);
      childrenOf.get(m.managerId).push(m.id);
    }
  });

  const collapse = { ...baseCollapse };
  const visited = new Set([rootId]);
  const queue = [{ id: rootId, depth: 0 }];
  while (queue.length > 0) {
    const { id, depth } = queue.shift();
    const kids = childrenOf.get(id) || [];
    if (kids.length > 0 && depth >= autoExpandDepth) {
      collapse[id] = true;
    }
    kids.forEach((childId) => {
      if (!visited.has(childId)) {
        visited.add(childId);
        queue.push({ id: childId, depth: depth + 1 });
      }
    });
  }
  return collapse;
}

/**
 * All descendant ids of rootId (children, grandchildren, ...), walked via managerId -
 * NOT including rootId itself. Cycle-guarded the same way as isDescendant/getAncestorIds
 * above. Used by buildFocusTree below to cut out just one person's subtree.
 */
export function collectDescendantIds(members, rootId) {
  const byManager = new Map();
  members.forEach((m) => {
    if (m.managerId) {
      if (!byManager.has(m.managerId)) byManager.set(m.managerId, []);
      byManager.get(m.managerId).push(m.id);
    }
  });

  const result = new Set();
  const visited = new Set([rootId]);
  const queue = [rootId];
  while (queue.length > 0) {
    const id = queue.shift();
    const kids = byManager.get(id) || [];
    kids.forEach((kidId) => {
      if (!visited.has(kidId)) {
        visited.add(kidId);
        result.add(kidId);
        queue.push(kidId);
      }
    });
  }
  return result;
}

/**
 * Builds a tree rooted at ONE chosen employee (the "Focus" view - see FocusView.jsx) -
 * that employee plus everyone below them, with everyone above and beside them left out
 * entirely (not just hidden - buildOrgTree never even sees them, so nothing about the
 * real root/ancestors leaks in via the orphan-grouping fallback either). Reuses
 * buildOrgTree as-is by handing it a filtered member list with the chosen employee's
 * own managerId cleared, so buildOrgTree's normal root-selection picks them.
 */
export function buildFocusTree(members, rootId, collapseState = {}) {
  const rootMember = members.find((m) => m.id === rootId);
  if (!rootMember) return { root: null, memberMap: new Map() };

  const descendantIds = collectDescendantIds(members, rootId);
  const subtreeMembers = [
    { ...rootMember, managerId: null },
    ...members.filter((m) => descendantIds.has(m.id))
  ];
  return buildOrgTree(subtreeMembers, collapseState);
}

/**
 * Decides what a card/box should show as its PRIMARY (bold) and SECONDARY (smaller)
 * label, given the current "Display by" field choice and whether names should be
 * hidden entirely (see the Display controls in ControlsBar.jsx). ONE shared rule used
 * by both the on-screen card (OrgNode.jsx) and the PPT export (exportPpt.js) - so a
 * presentation exported to PPT always matches exactly what was on screen when it was
 * generated, rather than two independently-written label rules drifting apart.
 *
 * - displayField picks the primary field: 'name' | 'title' | 'department' | 'entity' | 'projects'.
 * - hideNames forces the primary away from 'name' (falls back to 'title'/Designation) -
 *   asking to hide names while also asking to show Name as the primary field is
 *   contradictory, so hiding wins.
 * - The secondary line is Designation, unless Designation IS the primary (then it's
 *   Department instead) - keeps the two lines from ever duplicating each other. Name is
 *   never used as the secondary line, so hideNames can never leak a name that way either.
 */
export function getDisplayLabels(member, { displayField = 'name', hideNames = false } = {}) {
  const fieldMap = {
    name: member.name,
    title: member.title,
    department: member.department,
    entity: member.entity,
    projects: member.projects
  };

  const effectiveField = (hideNames && displayField === 'name') ? 'title' : displayField;
  const primary = fieldMap[effectiveField] || member.name || member.id;

  const secondaryField = effectiveField === 'title' ? 'department' : 'title';
  const secondary = fieldMap[secondaryField] || '';

  return { primary, secondary };
}

/**
 * A member counts as "inactive" only when their status is exactly 'inactive' - someone
 * 'on-leave' or 'hiring' (or any other status value) still counts as visible. Case-
 * insensitive so a live-Sheet cell typed as "Inactive" still matches.
 */
export function isInactiveStatus(member) {
  return String(member?.status || '').trim().toLowerCase() === 'inactive';
}

/**
 * Returns a new members array with every inactive member removed, while keeping the
 * org hierarchy connected: anyone (active, on-leave, hiring, etc.) who reported -
 * directly or through a chain of managers - to an inactive person gets re-pointed to
 * the nearest non-inactive manager above that chain (skip-level), instead of vanishing
 * from the tree or being dumped in the "Unknown RM" bucket just because their manager
 * was marked inactive. A managerId that doesn't resolve to any real member at all (the
 * pre-existing bad-data case, unrelated to status) is left exactly as-is - buildOrgTree's
 * own orphan grouping already handles that separately, and re-pointing here would erase
 * the very manager-id it needs to flag as broken.
 *
 * Does not mutate `members` - callers that need the untouched raw list (e.g. the
 * Manager picker, which should still be able to find everyone) keep using it directly.
 */
// Shared by reparentAroundInactive (below) and resolveSkipLevelManagerId - walks a
// managerId chain starting at `startManagerId`, skipping past any inactive manager,
// and returns the first non-inactive one it finds. `selfId` is only used for the cycle
// guard (a chain must never walk back through the member it started from).
function walkToVisibleManagerId(byId, selfId, startManagerId) {
  let currentId = startManagerId;
  // Same cycle guard pattern as isDescendant/getAncestorIds above - a circular
  // managerId chain must not walk forever.
  const visited = new Set([selfId]);
  while (currentId) {
    if (visited.has(currentId)) return null;
    visited.add(currentId);
    const manager = byId.get(currentId);
    if (!manager) return currentId; // unresolved id - preserve existing orphan behavior
    if (!isInactiveStatus(manager)) return manager.id;
    currentId = manager.managerId;
  }
  return null; // walked all the way to the top without finding a non-inactive manager
}

export function reparentAroundInactive(members) {
  const byId = new Map(members.map((m) => [m.id, m]));

  return members
    .filter((m) => !isInactiveStatus(m))
    .map((m) => {
      const resolvedManagerId = walkToVisibleManagerId(byId, m.id, m.managerId);
      return resolvedManagerId === m.managerId ? m : { ...m, managerId: resolvedManagerId };
    });
}

/**
 * For ONE member who is (about to become) inactive, finds the nearest non-inactive
 * manager above them - i.e. what their direct reports should be re-pointed to so the
 * hierarchy stays connected once this member is hidden. Used when a Sheet write needs
 * to actually persist a reassignment (see handleSaveMember in App.jsx) - reuses the
 * exact same walk as reparentAroundInactive so the Tree's computed view and a real
 * Sheet mutation never disagree about where a report lands, even when several managers
 * in a row are inactive.
 */
export function resolveSkipLevelManagerId(members, memberId) {
  const member = members.find((m) => m.id === memberId);
  if (!member) return null;
  const byId = new Map(members.map((m) => [m.id, m]));
  return walkToVisibleManagerId(byId, memberId, member.managerId);
}

/**
 * Checks if targetId is an ancestor of proposedManagerId (prevents circular hierarchy)
 */
export function isDescendant(members, targetId, proposedManagerId) {
  if (targetId === proposedManagerId) return true;
  const map = new Map(members.map(m => [m.id, m]));

  // Guard against a circular managerId chain in the data (e.g. someone whose
  // managerId - directly or a few hops up - loops back to themselves). Without the
  // `visited` check this walk never terminates and freezes the tab.
  const visited = new Set([proposedManagerId]);
  let current = map.get(proposedManagerId);
  while (current && current.managerId && !visited.has(current.managerId)) {
    if (current.managerId === targetId) return true;
    visited.add(current.managerId);
    current = map.get(current.managerId);
  }
  return false;
}

/**
 * Returns set of ancestor IDs for a given member (to auto-expand path to search results)
 */
export function getAncestorIds(memberId, memberMap) {
  const ancestorIds = new Set();
  // Same cycle guard as isDescendant above - a self-referencing or circular managerId
  // in the data must not turn this into an infinite loop (this runs on every search
  // keystroke, so a single bad row here hangs the whole app, not just one lookup).
  const visited = new Set([memberId]);
  let current = memberMap.get(memberId);
  while (current && current.managerId && !visited.has(current.managerId)) {
    ancestorIds.add(current.managerId);
    visited.add(current.managerId);
    current = memberMap.get(current.managerId);
  }
  return ancestorIds;
}

/**
 * Filter org members by search term, department, and level
 */
export function filterMembers(members, { search = '', department = 'all', level = 'all', status = 'all', entity = 'all' }) {
  const query = search.toLowerCase().trim();

  return members.filter(m => {
    const matchesQuery = !query ||
      m.name.toLowerCase().includes(query) ||
      m.title.toLowerCase().includes(query) ||
      m.email.toLowerCase().includes(query) ||
      m.location.toLowerCase().includes(query) ||
      (m.entity || '').toLowerCase().includes(query) ||
      (m.projects || '').toLowerCase().includes(query) ||
      (m.skills && m.skills.some(s => s.toLowerCase().includes(query)));

    const matchesDept = department === 'all' || m.department === department;
    const matchesLevel = level === 'all' || m.level === level;
    const matchesStatus = status === 'all' || m.status === status;
    const matchesEntity = entity === 'all' || m.entity === entity;

    return matchesQuery && matchesDept && matchesLevel && matchesStatus && matchesEntity;
  });
}

/**
 * Calculates analytics and metrics from members dataset
 */
export function computeOrgStats(members) {
  const total = members.length;
  const deptCounts = {};
  const levelCounts = {};
  const locationCounts = {};
  const statusCounts = {};

  const managerIds = new Set(members.map(m => m.managerId).filter(Boolean));
  const totalManagers = managerIds.size;
  const totalICs = total - totalManagers;

  let totalDirectReportsSum = 0;
  
  members.forEach(m => {
    // Dept breakdown
    deptCounts[m.department] = (deptCounts[m.department] || 0) + 1;
    // Level breakdown
    levelCounts[m.level] = (levelCounts[m.level] || 0) + 1;
    // Location breakdown
    const locKey = m.location.includes('Remote') ? 'Remote' : m.location.split(',')[0] || m.location;
    locationCounts[locKey] = (locationCounts[locKey] || 0) + 1;
    // Status
    statusCounts[m.status] = (statusCounts[m.status] || 0) + 1;

    // Count direct reports for managers
    const reports = members.filter(r => r.managerId === m.id).length;
    if (reports > 0) {
      totalDirectReportsSum += reports;
    }
  });

  const avgSpanOfControl = totalManagers > 0 ? (totalDirectReportsSum / totalManagers).toFixed(1) : '0';

  return {
    total,
    totalManagers,
    totalICs,
    avgSpanOfControl,
    deptCounts,
    levelCounts,
    locationCounts,
    statusCounts
  };
}

/**
 * Export org chart data as CSV string
 */
export function exportToCSV(members) {
  const headers = ['ID', 'Name', 'Title', 'Department', 'Email', 'Phone', 'Location', 'Level', 'Status', 'Manager ID'];
  const rows = members.map(m => [
    m.id,
    `"${m.name.replace(/"/g, '""')}"`,
    `"${m.title.replace(/"/g, '""')}"`,
    `"${m.department}"`,
    `"${m.email}"`,
    `"${m.phone}"`,
    `"${m.location}"`,
    `"${m.level}"`,
    `"${m.status}"`,
    `"${m.managerId || ''}"`
  ]);

  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
}
