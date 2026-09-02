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
  // case above) is attached under the root instead of vanishing from the chart.
  let orphanCount = 0;
  memberMap.forEach(node => {
    if (!node.managerId) return; // already placed in pass 1
    const manager = memberMap.get(node.managerId);
    if (manager) {
      manager.children.push(node);
    } else if (root && node.id !== root.id) {
      root.children.push(node);
      orphanCount += 1;
    }
  });

  if (!root) {
    // Extremely unlikely (every single row has SOME managerId value) - fall back to
    // the first row so the chart still renders something instead of going blank.
    root = memberMap.values().next().value || null;
  }

  if (orphanCount > 0 && typeof console !== 'undefined') {
    console.warn(
      `buildOrgTree: ${orphanCount} employee(s) have a managerId that doesn't match ` +
      `any employee id and were attached directly under the root. Check those rows ` +
      `for typos or a manager who was removed from the sheet.`
    );
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
export function filterMembers(members, { search = '', department = 'all', level = 'all', status = 'all' }) {
  const query = search.toLowerCase().trim();

  return members.filter(m => {
    const matchesQuery = !query || 
      m.name.toLowerCase().includes(query) ||
      m.title.toLowerCase().includes(query) ||
      m.email.toLowerCase().includes(query) ||
      m.location.toLowerCase().includes(query) ||
      (m.skills && m.skills.some(s => s.toLowerCase().includes(query)));

    const matchesDept = department === 'all' || m.department === department;
    const matchesLevel = level === 'all' || m.level === level;
    const matchesStatus = status === 'all' || m.status === status;

    return matchesQuery && matchesDept && matchesLevel && matchesStatus;
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
