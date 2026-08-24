import React, { useState, useEffect } from 'react';
import { X, UserPlus, Edit3, Sparkles } from 'lucide-react';
import { DEPARTMENTS } from '../data/initialData';
import { isDescendant } from '../utils/orgUtils';

export default function MemberModal({
  isOpen,
  mode = 'add', // 'add' or 'edit'
  initialData = null,
  presetManagerId = null,
  allMembers = [],
  onClose,
  onSave
}) {
  const [formData, setFormData] = useState({
    name: '',
    title: '',
    department: 'Engineering',
    level: 'Senior',
    managerId: presetManagerId || (allMembers[0]?.id || ''),
    email: '',
    phone: '',
    location: 'San Francisco, CA',
    avatar: '',
    status: 'active',
    skills: '',
    bio: ''
  });

  useEffect(() => {
    if (mode === 'edit' && initialData) {
      setFormData({
        ...initialData,
        skills: Array.isArray(initialData.skills) ? initialData.skills.join(', ') : (initialData.skills || '')
      });
    } else if (mode === 'add') {
      setFormData({
        name: '',
        title: '',
        department: 'Engineering',
        level: 'Senior',
        managerId: presetManagerId || (allMembers[0]?.id || ''),
        email: '',
        phone: '',
        location: 'San Francisco, CA',
        avatar: '',
        status: 'active',
        skills: 'React, Architecture, Team Leadership',
        bio: ''
      });
    }
  }, [mode, initialData, presetManagerId, allMembers]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.title.trim()) return;

    const skillsArray = formData.skills
      ? formData.skills.split(',').map(s => s.trim()).filter(Boolean)
      : [];

    const memberPayload = {
      ...formData,
      skills: skillsArray,
      id: mode === 'edit' ? initialData.id : `emp-${Date.now()}`
    };

    onSave(memberPayload);
    onClose();
  };

  // Filter out invalid manager choices (cannot report to self or descendant)
  const validManagers = allMembers.filter(m => {
    if (mode === 'edit' && initialData) {
      return !isDescendant(allMembers, initialData.id, m.id);
    }
    return true;
  });

  const handleRandomAvatar = () => {
    const gender = Math.random() > 0.5 ? 'women' : 'men';
    const num = Math.floor(Math.random() * 90) + 1;
    const randomUrl = `https://randomuser.me/api/portraits/${gender}/${num}.jpg`;
    setFormData(prev => ({ ...prev, avatar: randomUrl }));
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {mode === 'add' ? <UserPlus size={20} style={{ color: 'var(--accent-primary)' }} /> : <Edit3 size={20} style={{ color: 'var(--accent-primary)' }} />}
            <h3 style={{ fontSize: 16, fontWeight: 700 }}>
              {mode === 'add' ? 'Add New Employee' : 'Edit Member Details'}
            </h3>
          </div>
          <button className="icon-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div className="form-group">
                <label className="form-label">Full Name *</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Sarah Jenkins"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Job Title *</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Senior Frontend Architect"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div className="form-group">
                <label className="form-label">Department</label>
                <select
                  className="form-control"
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                >
                  {Object.keys(DEPARTMENTS).map(deptKey => (
                    <option key={deptKey} value={deptKey}>
                      {DEPARTMENTS[deptKey].name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Seniority Level</label>
                <select
                  className="form-control"
                  value={formData.level}
                  onChange={(e) => setFormData({ ...formData, level: e.target.value })}
                >
                  <option value="C-Level">C-Level</option>
                  <option value="VP">VP</option>
                  <option value="Director">Director</option>
                  <option value="Lead">Lead</option>
                  <option value="Senior">Senior</option>
                  <option value="Mid">Mid</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Reports To (Manager)</label>
              <select
                className="form-control"
                value={formData.managerId || ''}
                onChange={(e) => setFormData({ ...formData, managerId: e.target.value || null })}
              >
                <option value="">None (Top-Level Executive)</option>
                {validManagers.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.title} - {m.department})
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div className="form-group">
                <label className="form-label">Email Address</label>
                <input
                  type="email"
                  className="form-control"
                  placeholder="name@nexus.io"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Location</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="San Francisco, CA"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Avatar Image URL</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="url"
                  className="form-control"
                  placeholder="https://..."
                  value={formData.avatar}
                  onChange={(e) => setFormData({ ...formData, avatar: e.target.value })}
                />
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleRandomAvatar}
                  title="Generate Random Avatar"
                  style={{ whiteSpace: 'nowrap' }}
                >
                  <Sparkles size={14} />
                  <span>Random</span>
                </button>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Key Skills (comma separated)</label>
              <input
                type="text"
                className="form-control"
                placeholder="React, Distributed Systems, Python"
                value={formData.skills}
                onChange={(e) => setFormData({ ...formData, skills: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Short Bio</label>
              <textarea
                className="form-control"
                rows="2"
                placeholder="Brief summary of experience..."
                value={formData.bio}
                onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
              />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              {mode === 'add' ? 'Add Employee' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
