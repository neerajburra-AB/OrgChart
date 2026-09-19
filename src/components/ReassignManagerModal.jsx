import React, { useState } from 'react';
import { X, ArrowRightLeft, AlertTriangle } from 'lucide-react';
import ManagerPicker from './ManagerPicker';
import { collectDescendantIds } from '../utils/orgUtils';

// "B left, C takes over" - instead of opening each of B's direct reports one at a
// time and editing their "Reports To" field, this bulk-moves ALL of them to a new
// manager in one confirm. B's own record (name, id, status, matrixManagerId
// references anyone else has to them, etc.) is left completely untouched - this
// only ever changes the OTHER employees' managerId, never overwrites/reuses B's
// identity. That distinction matters: reusing B's id/row for C would silently
// corrupt B's real employee ID on C's card and erase B's own history, which is a
// data integrity bug, not a shortcut - see the "Reassign Direct Reports" button in
// MemberDrawer.jsx for the fuller reasoning.
export default function ReassignManagerModal({ member, allMembers, onClose, onConfirm }) {
  // undefined = "nothing picked yet" (Confirm stays disabled), distinct from null
  // ("None (Top-Level Executive)" deliberately picked) - so opening this modal and
  // immediately hitting Confirm can never silently top-level every report.
  const [newManagerId, setNewManagerId] = useState(undefined);
  const [isSaving, setIsSaving] = useState(false);

  if (!member) return null;

  const directReports = allMembers.filter((m) => m.managerId === member.id);

  // Cycle guard - but NOT the same rule the real "Reports To" field uses (that one
  // excludes every descendant of the person being edited, which here would be every
  // descendant of B, INCLUDING B's own direct reports - and excluding those would
  // rule out the single most common real case: one of B's own reports getting
  // promoted to lead the rest of the team). What actually has to be excluded is
  // narrower: anyone nested BELOW one of the reports being moved (a grandchild of
  // B, e.g.) - since none of their managerId is changing here, picking one of them
  // as the new manager would wire a report straight back to its own descendant. A
  // direct report itself is safe to pick (siblings can't be in each other's chain),
  // so it's deliberately left in - see the skippedSelf handling below.
  const descendantsOfReports = new Set();
  directReports.forEach((r) => {
    collectDescendantIds(allMembers, r.id).forEach((id) => descendantsOfReports.add(id));
  });
  const eligibleManagers = allMembers.filter(
    (m) => m.id !== member.id && !descendantsOfReports.has(m.id)
  );

  // A very normal case: one of B's own direct reports, C, is the one taking over
  // the team. C can't be reassigned to report to themselves though, so C is left
  // out of this bulk move - their own managerId is untouched here. If C is being
  // promoted into B's old seat, edit C's own "Reports To" separately afterwards
  // (typically to whoever B used to report to).
  const skippedSelf = directReports.find((r) => r.id === newManagerId);
  const willMove = directReports.filter((r) => r.id !== newManagerId);

  const hasChosen = newManagerId !== undefined;
  const chosenManager = allMembers.find((m) => m.id === newManagerId);

  const handleConfirm = async () => {
    setIsSaving(true);
    await onConfirm(newManagerId, willMove);
    setIsSaving(false);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <ArrowRightLeft size={20} style={{ color: 'var(--accent-primary)' }} />
            <h3 style={{ fontSize: 16, fontWeight: 700 }}>
              Reassign {member.name}'s Direct Reports
            </h3>
          </div>
          <button className="icon-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 16 }}>
            {directReports.length} employee{directReports.length === 1 ? '' : 's'} currently report{directReports.length === 1 ? 's' : ''} to {member.name}: {directReports.map((r) => r.name).join(', ')}.
            {' '}Pick who they should report to instead - this only changes their own managerId.
            {' '}{member.name}'s own record and reporting line are not touched by this action.
          </p>

          <div className="form-group">
            <label className="form-label">New Manager For These Reports</label>
            <ManagerPicker
              members={eligibleManagers}
              value={newManagerId}
              onChange={setNewManagerId}
              placeholder="Select a manager..."
            />
          </div>

          {skippedSelf && (
            <div
              style={{
                display: 'flex',
                gap: 8,
                alignItems: 'flex-start',
                fontSize: 12,
                color: '#f59e0b',
                background: 'rgba(245,158,11,0.1)',
                border: '1px solid rgba(245,158,11,0.3)',
                borderRadius: 8,
                padding: 10,
                marginTop: 12
              }}
            >
              <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>
                {skippedSelf.name} can't be reassigned to report to themselves, so they're left out
                of this move ({willMove.length} of {directReports.length} will actually move). If{' '}
                {skippedSelf.name} is taking over this team, edit their own "Reports To" separately.
              </span>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isSaving}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleConfirm}
            disabled={!hasChosen || isSaving || willMove.length === 0}
          >
            {isSaving
              ? 'Reassigning...'
              : `Reassign ${willMove.length} Employee${willMove.length === 1 ? '' : 's'}${chosenManager ? ` to ${chosenManager.name}` : ' (Top-Level)'}`}
          </button>
        </div>
      </div>
    </div>
  );
}
