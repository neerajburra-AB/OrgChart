import React from 'react';
import { Users, UserCheck, Briefcase, Network, Globe, Award, Layers } from 'lucide-react';
import { computeOrgStats } from '../utils/orgUtils';
import { DEPARTMENTS } from '../data/initialData';

export default function AnalyticsView({ members }) {
  const stats = computeOrgStats(members);

  return (
    <div className="analytics-container">
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em' }}>
          Organization Analytics & Team Intelligence
        </h2>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
          Real-time metrics on headcount distribution, management span of control, and department allocation.
        </p>
      </div>

      {/* Metric Cards Top Row */}
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-icon" style={{ background: 'rgba(99, 102, 241, 0.15)', color: '#6366f1' }}>
            <Users size={26} />
          </div>
          <div>
            <div className="metric-value">{stats.total}</div>
            <div className="metric-label">Total Headcount</div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon" style={{ background: 'rgba(139, 92, 246, 0.15)', color: '#8b5cf6' }}>
            <UserCheck size={26} />
          </div>
          <div>
            <div className="metric-value">{stats.totalManagers}</div>
            <div className="metric-label">People Managers</div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon" style={{ background: 'rgba(6, 182, 212, 0.15)', color: '#06b6d4' }}>
            <Briefcase size={26} />
          </div>
          <div>
            <div className="metric-value">{stats.totalICs}</div>
            <div className="metric-label">Individual Contributors</div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
            <Network size={26} />
          </div>
          <div>
            <div className="metric-value">{stats.avgSpanOfControl}</div>
            <div className="metric-label">Avg Span of Control</div>
          </div>
        </div>
      </div>

      {/* Detailed Breakdown Charts Grid */}
      <div className="charts-grid">
        {/* Department Breakdown */}
        <div className="chart-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
            <Layers size={18} style={{ color: 'var(--accent-primary)' }} />
            <h3 className="chart-title" style={{ margin: 0 }}>Department Distribution</h3>
          </div>

          <div className="progress-list">
            {Object.keys(DEPARTMENTS).map((deptKey) => {
              const dept = DEPARTMENTS[deptKey];
              const count = stats.deptCounts[deptKey] || 0;
              const percentage = stats.total > 0 ? ((count / stats.total) * 100).toFixed(1) : 0;

              return (
                <div key={deptKey} className="progress-item">
                  <div className="progress-header">
                    <span style={{ fontWeight: 600 }}>{dept.name}</span>
                    <span style={{ color: 'var(--text-secondary)' }}>
                      {count} ({percentage}%)
                    </span>
                  </div>
                  <div className="progress-bar-bg">
                    <div
                      className="progress-bar-fill"
                      style={{
                        width: `${percentage}%`,
                        backgroundColor: dept.color
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Seniority Level Breakdown */}
        <div className="chart-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
            <Award size={18} style={{ color: 'var(--accent-secondary)' }} />
            <h3 className="chart-title" style={{ margin: 0 }}>Seniority Level Distribution</h3>
          </div>

          <div className="progress-list">
            {['C-Level', 'VP', 'Director', 'Lead', 'Senior', 'Mid'].map((level) => {
              const count = stats.levelCounts[level] || 0;
              const percentage = stats.total > 0 ? ((count / stats.total) * 100).toFixed(1) : 0;

              return (
                <div key={level} className="progress-item">
                  <div className="progress-header">
                    <span style={{ fontWeight: 600 }}>{level}</span>
                    <span style={{ color: 'var(--text-secondary)' }}>
                      {count} ({percentage}%)
                    </span>
                  </div>
                  <div className="progress-bar-bg">
                    <div
                      className="progress-bar-fill"
                      style={{
                        width: `${percentage}%`,
                        background: 'linear-gradient(90deg, #6366f1, #8b5cf6)'
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
