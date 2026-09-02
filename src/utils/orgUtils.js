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

  // Connect parents and children.
  // Note: a dataset can contain more than one node with no manager, or a managerId
  // that doesn't match anyone (typos, deleted managers, bad imports) - this becomes
  // more likely the larger the dataset. The first such node found becomes the root;
  // any others are attached under that root instead of silently overwriting it and
  // dropping their whole subtree from the chart.
  memberMap.forEach(node => {
    if (!node.managerId || !memberMap.has(node.managerId)) {
      if (!root) {
        root = node;
      } else if (node.id !== root.id) {
        root.children.push(node);
      }
    } else {
      const manager = memberMap.get(node.managerId);
      manager.children.push(node);
    }
  });

  // Calculate subtree sizes recursively
  function computeSubtreeCounts(node) {
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
  
  let current = map.get(proposedManagerId);
  while (current && current.managerId) {
    if (current.managerId === targetId) return true;
    current = map.get(current.managerId);
  }
  return false;
}

/**
 * Returns set of ancestor IDs for a given member (to auto-expand path to search results)
 */
export function getAncestorIds(memberId, memberMap) {
  const ancestorIds = new Set();
  let current = memberMap.get(memberId);
  while (current && current.managerId) {
    ancestorIds.add(current.managerId);
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
