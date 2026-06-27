import React, { useState, useEffect } from "react";
import { useAuthStore } from "../../stores/authStore";
import { fetchAllAssignments, createAssignment, fetchTrainingUsers, updateAssignmentStatus, getTrainingTracks } from "../../services/trainingEngine";
import { ClipboardList, Plus, CheckCircle, Clock, X, UserPlus, ChevronLeft } from "lucide-react";

export default function ManagerAssignments({ onBack, t }) {
  const user = useAuthStore(s => s.user);
  const [assignments, setAssignments] = useState([]);
  const [users, setUsers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [selectedUser, setSelectedUser] = useState("");
  const [selectedTrack, setSelectedTrack] = useState("");
  const [deadline, setDeadline] = useState("");

  const tracks = getTrainingTracks("admin");

  const load = async () => {
    const [aRes, uRes] = await Promise.all([fetchAllAssignments(), fetchTrainingUsers()]);
    if (aRes.success) setAssignments(aRes.data || []);
    if (uRes.success) setUsers(uRes.data || []);
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!selectedUser || !selectedTrack) return;
    await createAssignment(Number(selectedUser), selectedTrack, deadline || null);
    setShowForm(false);
    setSelectedUser(""); setSelectedTrack(""); setDeadline("");
    load();
  };

  const statusIcon = (status) => {
    switch (status) {
      case "completed": return <CheckCircle className="h-3 w-3" style={{ color: "var(--success-text)" }} />;
      case "in_progress": return <Clock className="h-3 w-3" style={{ color: "var(--primary)" }} />;
      default: return <Clock className="h-3 w-3" style={{ color: "var(--warning-text)" }} />;
    }
  };

  const statusStyle = (status) => {
    switch (status) {
      case "completed": return { background: "var(--success-bg)", color: "var(--success-text)" };
      case "in_progress": return { background: "var(--bg-input)", color: "var(--primary)" };
      default: return { background: "var(--warning-bg)", color: "var(--warning-text)" };
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-1.5">
          {onBack && (
            <button onClick={onBack} className="rounded-lg p-1 hover:bg-black/5" style={{ color: "var(--text-muted)" }}>
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
          )}
          <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
            <ClipboardList className="inline h-3 w-3 ml-1" /> {t?.("assignments.title") || "التكليفات"}
          </span>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-black"
          style={{ background: "var(--bg-input)", color: "var(--primary)" }}>
          <Plus className="h-3 w-3" /> {t?.("assignments.assign") || "تكليف"}
        </button>
      </div>

      {showForm && (
        <div className="rounded-2xl border p-3 space-y-2"
          style={{ background: "var(--bg-surface)", borderColor: "var(--border-normal)" }}>
          <select value={selectedUser} onChange={e => setSelectedUser(e.target.value)}
            className="w-full rounded-xl border bg-transparent px-3 py-1.5 text-[12px] font-bold outline-none"
            style={{ borderColor: "var(--border-normal)", color: "var(--text-primary)" }}>
            <option value="">{t?.("assignments.selectUser") || "اختر المستخدم"}</option>
            {users.map(u => (
              <option key={u.id} value={u.id}>{u.username} {u.full_name ? `(${u.full_name})` : ""}</option>
            ))}
          </select>
          <select value={selectedTrack} onChange={e => setSelectedTrack(e.target.value)}
            className="w-full rounded-xl border bg-transparent px-3 py-1.5 text-[12px] font-bold outline-none"
            style={{ borderColor: "var(--border-normal)", color: "var(--text-primary)" }}>
            <option value="">{t?.("assignments.selectTrack") || "اختر المسار"}</option>
            {tracks.map(tr => (
              <option key={tr.id} value={tr.id}>{tr.nameAr}</option>
            ))}
          </select>
          <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)}
            className="w-full rounded-xl border bg-transparent px-3 py-1.5 text-[12px] font-bold outline-none"
            style={{ borderColor: "var(--border-normal)", color: "var(--text-primary)" }} />
          <div className="flex gap-2">
            <button onClick={handleCreate}
              className="flex items-center gap-1 rounded-xl px-3 py-1.5 text-[11px] font-black text-white"
              style={{ background: "var(--primary)" }}>
              <UserPlus className="h-3 w-3" /> {t?.("assignments.create") || "إنشاء"}
            </button>
            <button onClick={() => setShowForm(false)}
              className="rounded-xl border px-3 py-1.5 text-[11px] font-bold"
              style={{ borderColor: "var(--border-normal)", color: "var(--text-secondary)" }}>
              {t?.("assignments.cancel") || "إلغاء"}
            </button>
          </div>
        </div>
      )}

      {assignments.length === 0 && !showForm && (
        <p className="px-1 text-[11px] font-bold" style={{ color: "var(--text-muted)" }}>
          {t?.("assignments.empty") || "لا توجد تكليفات بعد. كلف موظف بمسار تدريبي معين."}
        </p>
      )}

      <div className="space-y-1.5">
        {assignments.map(a => (
          <div key={a.id}
            className="rounded-xl border p-2.5"
            style={{ background: "var(--bg-surface)", borderColor: "var(--border-normal)" }}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5">
                {statusIcon(a.status)}
                <span className="text-[11px] font-black" style={{ color: "var(--text-primary)" }}>
                  {a.assigned_to_name}
                </span>
              </div>
              <span className="text-[10px] font-bold" style={{ color: "var(--text-muted)" }}>
                {a.track}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-semibold" style={{ color: "var(--text-muted)" }}>
                {t?.("assignments.by") || "بواسطة"}: {a.assigned_by_name}
                {a.deadline && ` — ${t?.("assignments.deadline") || "آخر موعد"}: ${a.deadline}`}
              </span>
              <span className="rounded-full px-2 py-0.5 text-[9px] font-bold"
                style={statusStyle(a.status)}>
                {a.status === "completed" ? (t?.("assignments.completed") || "مكتمل") :
                 a.status === "in_progress" ? (t?.("assignments.inProgress") || "قيد التنفيذ") :
                 (t?.("assignments.pending") || "معلق")}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
