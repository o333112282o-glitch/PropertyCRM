import { useState, useCallback, useEffect } from 'react';
import { Plus, Edit2, Trash2, Archive, FolderOpen, MapPin } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Project, ProjectStatus } from '@/lib/types';
import { formatDate } from '@/lib/utils';
import Modal from '@/components/ui/Modal';

export default function ProjectsManagement() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [status, setStatus] = useState<ProjectStatus>('active');
  const [confirmDelete, setConfirmDelete] = useState<Project | null>(null);

  const fetchProjects = useCallback(async () => {
    const { data } = await supabase.from('projects').select('*').order('created_at', { ascending: false });
    setProjects((data as Project[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchProjects(); }, [fetchProjects]);

  const openAdd = () => {
    setEditingProject(null);
    setName(''); setDescription(''); setLocation(''); setStatus('active');
    setShowForm(true);
  };

  const openEdit = (p: Project) => {
    setEditingProject(p);
    setName(p.name); setDescription(p.description); setLocation(p.location || ''); setStatus(p.status);
    setShowForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const payload = { name: name.trim(), description: description.trim(), location: location.trim() || null, status };
    if (editingProject) {
      await supabase.from('projects').update(payload).eq('id', editingProject.id);
    } else {
      await supabase.from('projects').insert(payload);
    }
    setShowForm(false);
    fetchProjects();
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    await supabase.from('projects').delete().eq('id', confirmDelete.id);
    setConfirmDelete(null);
    fetchProjects();
  };

  const toggleArchive = async (p: Project) => {
    const newStatus: ProjectStatus = p.status === 'active' ? 'archived' : 'active';
    await supabase.from('projects').update({ status: newStatus }).eq('id', p.id);
    fetchProjects();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-3 border-[#D4AF37] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
          <p className="text-gray-500 mt-0.5 text-sm">
            {projects.filter((p) => p.status === 'active').length} active · {projects.filter((p) => p.status === 'archived').length} archived
          </p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#F97316] hover:bg-[#ea580c] text-white font-semibold shadow-lg shadow-[#F97316]/20 transition active:scale-95"
        >
          <Plus size={20} />
          <span className="hidden sm:inline">Add Project</span>
        </button>
      </div>

      <div className="space-y-2.5">
        {projects.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
            <FolderOpen size={40} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500 font-medium">No projects yet</p>
            <p className="text-gray-400 text-sm mt-1">Create your first project to start linking leads</p>
          </div>
        ) : (
          projects.map((p) => (
            <div key={p.id} className="bg-white rounded-2xl border border-slate-200 p-4 hover:shadow-md transition">
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-xl bg-[#D4AF37]/15 text-[#a67c00] flex items-center justify-center flex-shrink-0">
                  <FolderOpen size={22} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-gray-900">{p.name}</h3>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${
                      p.status === 'active'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-slate-100 text-slate-500 border-slate-200'
                    }`}>
                      {p.status === 'active' ? 'Active' : 'Archived'}
                    </span>
                  </div>
                  {p.description && <p className="text-sm text-gray-500 mt-0.5 truncate">{p.description}</p>}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5 text-xs text-gray-400">
                    {p.location && <span className="flex items-center gap-1"><MapPin size={11} /> {p.location}</span>}
                    <span>Created {formatDate(p.created_at)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => toggleArchive(p)}
                    className="p-2 rounded-lg text-gray-400 hover:text-orange-600 hover:bg-orange-50 transition"
                    title={p.status === 'active' ? 'Archive' : 'Restore'}
                  >
                    <Archive size={16} />
                  </button>
                  <button
                    onClick={() => openEdit(p)}
                    className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-slate-100 transition"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    onClick={() => setConfirmDelete(p)}
                    className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editingProject ? 'Edit Project' : 'Add Project'}
        subtitle={editingProject ? editingProject.name : 'Create a new real estate project'}
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Project Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-gray-900 focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20 outline-none transition"
              placeholder="e.g. Skyline Residences"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Location</label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-gray-900 focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20 outline-none transition"
              placeholder="e.g. Whitefield, Bangalore"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-gray-900 focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20 outline-none transition resize-none"
              placeholder="Brief project description..."
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as ProjectStatus)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-gray-900 focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20 outline-none transition"
            >
              <option value="active">Active</option>
              <option value="archived">Archived</option>
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              className="flex-1 py-3 rounded-xl bg-[#1E293B] hover:bg-[#334155] text-white font-semibold shadow-lg shadow-[#1E293B]/20 transition active:scale-[.98]"
            >
              {editingProject ? 'Update' : 'Create'}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="flex-1 py-3 rounded-xl border border-slate-200 text-gray-700 font-semibold hover:bg-slate-50 transition"
            >
              Cancel
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Delete Project" size="sm">
        <p className="text-gray-600 mb-5">
          Delete <span className="font-semibold text-gray-900">{confirmDelete?.name}</span>? Leads linked to this project will keep their data but lose the project reference.
        </p>
        <div className="flex gap-3">
          <button
            onClick={handleDelete}
            className="flex-1 py-3 rounded-xl bg-red-500 hover:bg-red-600 text-white font-semibold transition"
          >
            Delete
          </button>
          <button
            onClick={() => setConfirmDelete(null)}
            className="flex-1 py-3 rounded-xl border border-slate-200 text-gray-700 font-semibold hover:bg-slate-50 transition"
          >
            Cancel
          </button>
        </div>
      </Modal>
    </div>
  );
}
