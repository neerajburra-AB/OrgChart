import React, { useState, useEffect, useMemo } from 'react';
import { X, UserPlus, Edit3, Sparkles } from 'lucide-react';
import { DEPARTMENTS } from '../data/initialData';
import { isDescendant, getUniqueSortedValues, LEVEL_RANK } from '../utils/orgUtils';

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
    department: '',
    entity: '',
    level: '',
    managerId: presetManagerId || (allMembers[0]?.id || ''),
    email: '',
    phone: '',
    location: '',
    avatar: '',
    status: 'active',
    skills: '',
    bio: ''
  });
  const [isSaving, setIsSaving] = useState(false);

  // Same data-driven pattern as the top toolbar's filter dropdowns (see App.jsx) - built
  // from whatever departments/levels/entities are actually in use, not a hardcoded demo
  // list, so this form can always represent a real employee's real values. Falls back to
  // the demo DEPARTMENTS keys / a starter level list only when there's no data yet to
  // learn options from (e.g. a brand new, empty sheet).
  const availableDepartments = useMemo(() => {
    const fromData = getUniqueSortedValues(allMembers, 'department');
    return fromData.length > 0 ? fromData : Object.keys(DEPARTMENTS);
  }, [allMembers]);

  const availableLevels = useMemo(() => {
    const fromData = getUniqueSortedValues(allMembers, 'level', LEVEL_RANK);
    return fromData.length > 0 ? fromData : ['C-Level', 'VP', 'Director', 'Lead', 'Senior', 'Mid'];
  }, [allMembers]);

  const availableEntities = useMemo(
    () => getUniqueSortedValues(allMembers, 'entity'),
    [allMembers]
  );

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
        // Default to the first real department/level actually in use, not a hardcoded
        // demo value - so leaving these untouched still saves a value that exists in the
        // dropdown (and in the real data), not a stray "Engineering"/"Senior" that may not
        // match anything in this company's actual Sheet.
        department: availableDepartments[0] || '',
        entity: '',
        level: availableLevels[0] || '',
        managerId: presetManagerId || (allMembers[0]?.id || ''),
        email: '',
        phone: '',
        location: '',
        avatar: '',
        status: 'active',
        skills: '',
        bio: ''
      });
    }
  }, [mode, initialData, presetManagerId, allMembers, availableDepartments, availableLevels]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
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

    setIsSaving(true);
    // onSave (handleSaveMember in App.jsx) writes to the live Sheet first and only returns
    // true once that's confirmed - so the modal stays open (and the user can retry or
    // cancel) if the Sheet write actually failed, instead of closing and silently losing
    // the edit.
    const success = await onSave(memberPayload);
    setIsSaving(false);
    if (success !== false) onClose();
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
                  {/* Built from departments actually in use (see availableDepartments above),
                      not a hardcoded demo list - so this always matches what the live Sheet
                      really has, same as the toolbar's filter dropdown. */}
                  {availableDepartments.map(deptKey => (
                    <option key={deptKey} value={deptKey}>
                      {DEPARTMENTS[deptKey]?.name || deptKey}
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
                  {availableLevels.map(level => (
                    <option key={level} value={level}>{level}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div className="form-group">
                <label className="form-label">Entity</label>
                <input
                  type="text"
                  className="form-control"
                  list="entity-options"
                  placeholder="e.g. Patel Infrastructure Ltd."
                  value={formData.entity}
                  onChange={(e) => setFormData({ ...formData, entity: e.target.value })}
                />
                {/* A text input with a datalist (not a plain <select>) so a genuinely new
                    entity can still be typed in, while existing ones are one click away. */}
                <datalist id="entity-options">
                  {availableEntities.map(entity => (
                    <option key={entity} value={entity} />
                  ))}
                </datalist>
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
