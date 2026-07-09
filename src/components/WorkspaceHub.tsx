import React, { useState, useEffect } from 'react';
import { connectWorkspace, getWorkspaceToken, disconnectWorkspace } from '../lib/workspaceAuth';
import { HardDrive, CheckSquare, MessageSquare, ExternalLink, Mail, Calendar, Users, FolderOpen } from 'lucide-react';

export default function WorkspaceHub() {
  const [token, setToken] = useState<string | null>(getWorkspaceToken());
  const [activeTab, setActiveTab] = useState<'drive' | 'tasks' | 'chat' | 'gmail' | 'calendar' | 'contacts' | 'picker'>('drive');

  const handleConnect = async () => {
    try {
      const newToken = await connectWorkspace();
      setToken(newToken);
    } catch (err) {
      console.error(err);
      alert('Failed to connect workspace');
    }
  };

  if (!token) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-zinc-400">
        <HardDrive className="w-16 h-16 mb-4 text-zinc-600" />
        <h2 className="text-xl font-bold text-white mb-2 uppercase font-mono tracking-widest">Workspace Integration</h2>
        <p className="text-sm mb-6 text-center max-w-sm">Connect your Google Workspace to access Drive, Tasks, Chat, Gmail, Calendar, Contacts, and Picker.</p>
        <button onClick={handleConnect} className="px-6 py-3 bg-[var(--neon-green)] text-black font-extrabold uppercase text-xs tracking-wider border-2 border-[var(--neon-green)] hover:bg-black hover:text-[var(--neon-green)] transition-all">
          Connect Workspace
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-black/40 border border-zinc-800 rounded-lg overflow-hidden">
      <div className="flex bg-zinc-950 border-b border-zinc-800 flex-wrap">
        <button 
          onClick={() => setActiveTab('drive')}
          className={`flex-1 min-w-[80px] p-3 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 ${activeTab === 'drive' ? 'text-[var(--neon-green)] border-b-2 border-[var(--neon-green)] bg-zinc-900/50' : 'text-zinc-500 hover:text-zinc-300'}`}
        >
          <HardDrive className="w-4 h-4" /> Drive
        </button>
        <button 
          onClick={() => setActiveTab('tasks')}
          className={`flex-1 min-w-[80px] p-3 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 ${activeTab === 'tasks' ? 'text-[#00ccff] border-b-2 border-[#00ccff] bg-zinc-900/50' : 'text-zinc-500 hover:text-zinc-300'}`}
        >
          <CheckSquare className="w-4 h-4" /> Tasks
        </button>
        <button 
          onClick={() => setActiveTab('chat')}
          className={`flex-1 min-w-[80px] p-3 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 ${activeTab === 'chat' ? 'text-[#ff0055] border-b-2 border-[#ff0055] bg-zinc-900/50' : 'text-zinc-500 hover:text-zinc-300'}`}
        >
          <MessageSquare className="w-4 h-4" /> Chat
        </button>
        <button 
          onClick={() => setActiveTab('gmail')}
          className={`flex-1 min-w-[80px] p-3 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 ${activeTab === 'gmail' ? 'text-[#ea4335] border-b-2 border-[#ea4335] bg-zinc-900/50' : 'text-zinc-500 hover:text-zinc-300'}`}
        >
          <Mail className="w-4 h-4" /> Gmail
        </button>
        <button 
          onClick={() => setActiveTab('calendar')}
          className={`flex-1 min-w-[80px] p-3 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 ${activeTab === 'calendar' ? 'text-[#4285f4] border-b-2 border-[#4285f4] bg-zinc-900/50' : 'text-zinc-500 hover:text-zinc-300'}`}
        >
          <Calendar className="w-4 h-4" /> Cal
        </button>
        <button 
          onClick={() => setActiveTab('contacts')}
          className={`flex-1 min-w-[80px] p-3 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 ${activeTab === 'contacts' ? 'text-[#fbbc05] border-b-2 border-[#fbbc05] bg-zinc-900/50' : 'text-zinc-500 hover:text-zinc-300'}`}
        >
          <Users className="w-4 h-4" /> Contacts
        </button>
        <button 
          onClick={() => setActiveTab('picker')}
          className={`flex-1 min-w-[80px] p-3 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 ${activeTab === 'picker' ? 'text-white border-b-2 border-white bg-zinc-900/50' : 'text-zinc-500 hover:text-zinc-300'}`}
        >
          <FolderOpen className="w-4 h-4" /> Picker
        </button>
      </div>

      <div className="flex-1 overflow-hidden relative">
        {activeTab === 'drive' && <DriveSection token={token} />}
        {activeTab === 'tasks' && <TasksSection token={token} />}
        {activeTab === 'chat' && <ChatSection token={token} />}
        {activeTab === 'gmail' && <GmailSection token={token} />}
        {activeTab === 'calendar' && <CalendarSection token={token} />}
        {activeTab === 'contacts' && <ContactsSection token={token} />}
        {activeTab === 'picker' && <PickerSection token={token} />}
      </div>
    </div>
  );
}

// --- Drive Section ---
function DriveSection({ token }: { token: string }) {
  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('https://www.googleapis.com/drive/v3/files?pageSize=20&fields=files(id,name,mimeType,webViewLink)', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(d => { setFiles(d.files || []); setLoading(false); })
      .catch(e => { console.error(e); setLoading(false); });
  }, [token]);

  if (loading) return <div className="p-6 text-zinc-500 font-mono text-xs uppercase animate-pulse">Scanning Drive Matrix...</div>;

  return (
    <div className="p-4 h-full overflow-y-auto space-y-2">
      {files.map(f => (
        <a key={f.id} href={f.webViewLink} target="_blank" rel="noreferrer" className="flex items-center justify-between p-3 bg-zinc-900/50 border border-zinc-800 hover:border-[var(--neon-green)]/50 transition-colors group">
          <span className="text-sm text-zinc-300 font-medium truncate">{f.name}</span>
          <ExternalLink className="w-4 h-4 text-zinc-600 group-hover:text-[var(--neon-green)] shrink-0 ml-2" />
        </a>
      ))}
    </div>
  );
}

// --- Tasks Section ---
function TasksSection({ token }: { token: string }) {
  const [tasks, setTasks] = useState<any[]>([]);
  const [lists, setLists] = useState<any[]>([]);
  const [activeList, setActiveList] = useState<string>('@default');
  const [loading, setLoading] = useState(true);
  const [newTaskTitle, setNewTaskTitle] = useState('');

  useEffect(() => {
    fetch('https://tasks.googleapis.com/tasks/v1/users/@me/lists', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(d => { 
        if(d.items && d.items.length > 0) {
          setLists(d.items);
          setActiveList(d.items[0].id);
        } else {
          setLoading(false);
        }
      })
      .catch(e => console.error(e));
  }, [token]);

  useEffect(() => {
    if (!activeList) return;
    setLoading(true);
    fetch(`https://tasks.googleapis.com/tasks/v1/lists/${activeList}/tasks`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(d => { setTasks(d.items || []); setLoading(false); })
      .catch(e => { console.error(e); setLoading(false); });
  }, [token, activeList]);

  const addTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim() || !activeList) return;
    try {
      const res = await fetch(`https://tasks.googleapis.com/tasks/v1/lists/${activeList}/tasks`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTaskTitle })
      });
      const data = await res.json();
      setTasks([data, ...tasks]);
      setNewTaskTitle('');
    } catch (e) {
      console.error(e);
    }
  };

  const completeTask = async (task: any) => {
    try {
      await fetch(`https://tasks.googleapis.com/tasks/v1/lists/${activeList}/tasks/${task.id}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...task, status: task.status === 'completed' ? 'needsAction' : 'completed' })
      });
      setTasks(tasks.map(t => t.id === task.id ? { ...t, status: task.status === 'completed' ? 'needsAction' : 'completed' } : t));
    } catch (e) {
      console.error(e);
    }
  };

  if (loading && tasks.length === 0) return <div className="p-6 text-[#00ccff] font-mono text-xs uppercase animate-pulse">Syncing Task List...</div>;

  return (
    <div className="flex flex-col h-full">
      <form onSubmit={addTask} className="p-3 border-b border-zinc-800 flex gap-2">
        <input 
          type="text" 
          value={newTaskTitle} 
          onChange={e => setNewTaskTitle(e.target.value)}
          placeholder="New Task..." 
          className="flex-1 bg-zinc-950 border border-zinc-800 p-2 text-sm text-white focus:outline-none focus:border-[#00ccff]"
        />
        <button type="submit" className="bg-[#00ccff] text-black px-4 font-bold uppercase text-xs hover:bg-white transition-colors">Add</button>
      </form>
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {tasks.map(t => (
          <div key={t.id} className="flex items-center gap-3 p-3 bg-zinc-900/50 border border-zinc-800">
            <button 
              onClick={() => completeTask(t)}
              className={`w-5 h-5 border-2 flex items-center justify-center shrink-0 ${t.status === 'completed' ? 'bg-[#00ccff] border-[#00ccff]' : 'border-zinc-600'}`}
            >
              {t.status === 'completed' && <CheckSquare className="w-3 h-3 text-black" />}
            </button>
            <span className={`text-sm flex-1 ${t.status === 'completed' ? 'line-through text-zinc-500' : 'text-zinc-200'}`}>{t.title}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- Chat Section ---
function ChatSection({ token }: { token: string }) {
  const [spaces, setSpaces] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('https://chat.googleapis.com/v1/spaces', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(d => { setSpaces(d.spaces || []); setLoading(false); })
      .catch(e => { console.error(e); setLoading(false); });
  }, [token]);

  if (loading) return <div className="p-6 text-[#ff0055] font-mono text-xs uppercase animate-pulse">Connecting to Comms...</div>;

  return (
    <div className="p-4 h-full overflow-y-auto space-y-2">
      {spaces.length === 0 ? (
        <div className="text-zinc-500 text-sm">No Google Chat spaces found.</div>
      ) : (
        spaces.map(s => (
          <div key={s.name} className="p-3 bg-zinc-900/50 border border-zinc-800 flex items-center gap-3">
            <MessageSquare className="w-4 h-4 text-[#ff0055]" />
            <div className="flex-1 min-w-0">
              <div className="text-sm text-zinc-200 font-bold truncate">{s.displayName || 'Direct Message'}</div>
              <div className="text-xs text-zinc-500 capitalize">{s.spaceType?.toLowerCase().replace('_', ' ')}</div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// --- Gmail Section ---
function GmailSection({ token }: { token: string }) {
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=10', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(async (d) => { 
        if (d.messages) {
          const detailedMessages = await Promise.all(
            d.messages.map((m: any) => 
              fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From`, {
                headers: { Authorization: `Bearer ${token}` }
              }).then(r => r.json())
            )
          );
          setMessages(detailedMessages);
        }
        setLoading(false); 
      })
      .catch(e => { console.error(e); setLoading(false); });
  }, [token]);

  if (loading) return <div className="p-6 text-[#ea4335] font-mono text-xs uppercase animate-pulse">Syncing Inbox...</div>;

  return (
    <div className="p-4 h-full overflow-y-auto space-y-2">
      {messages.length === 0 ? (
        <div className="text-zinc-500 text-sm">No emails found.</div>
      ) : (
        messages.map((m: any) => {
          const subject = m.payload?.headers?.find((h: any) => h.name === 'Subject')?.value || 'No Subject';
          const from = m.payload?.headers?.find((h: any) => h.name === 'From')?.value || 'Unknown';
          return (
            <div key={m.id} className="p-3 bg-zinc-900/50 border border-zinc-800 flex flex-col gap-1">
              <span className="text-sm text-zinc-200 font-bold truncate">{subject}</span>
              <span className="text-xs text-zinc-500 truncate">{from}</span>
            </div>
          );
        })
      )}
    </div>
  );
}

// --- Calendar Section ---
function CalendarSection({ token }: { token: string }) {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timeMin = new Date().toISOString();
    fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?maxResults=10&timeMin=${timeMin}&orderBy=startTime&singleEvents=true`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(d => { setEvents(d.items || []); setLoading(false); })
      .catch(e => { console.error(e); setLoading(false); });
  }, [token]);

  if (loading) return <div className="p-6 text-[#4285f4] font-mono text-xs uppercase animate-pulse">Scanning Schedule...</div>;

  return (
    <div className="p-4 h-full overflow-y-auto space-y-2">
      {events.length === 0 ? (
        <div className="text-zinc-500 text-sm">No upcoming events.</div>
      ) : (
        events.map((e: any) => (
          <div key={e.id} className="p-3 bg-zinc-900/50 border border-zinc-800 flex flex-col gap-1">
            <span className="text-sm text-zinc-200 font-bold truncate">{e.summary || 'Untitled Event'}</span>
            <span className="text-xs text-zinc-500">{new Date(e.start?.dateTime || e.start?.date).toLocaleString()}</span>
          </div>
        ))
      )}
    </div>
  );
}

// --- Contacts Section ---
function ContactsSection({ token }: { token: string }) {
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('https://people.googleapis.com/v1/people/me/connections?personFields=names,emailAddresses,photos&pageSize=20', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(d => { setContacts(d.connections || []); setLoading(false); })
      .catch(e => { console.error(e); setLoading(false); });
  }, [token]);

  if (loading) return <div className="p-6 text-[#fbbc05] font-mono text-xs uppercase animate-pulse">Loading Contacts...</div>;

  return (
    <div className="p-4 h-full overflow-y-auto space-y-2">
      {contacts.length === 0 ? (
        <div className="text-zinc-500 text-sm">No contacts found.</div>
      ) : (
        contacts.map((c: any) => {
          const name = c.names?.[0]?.displayName || 'Unknown';
          const email = c.emailAddresses?.[0]?.value || '';
          const photo = c.photos?.[0]?.url;
          return (
            <div key={c.resourceName} className="p-3 bg-zinc-900/50 border border-zinc-800 flex items-center gap-3">
              {photo ? <img src={photo} alt={name} className="w-8 h-8 rounded-full bg-zinc-800" referrerPolicy="no-referrer" /> : <div className="w-8 h-8 rounded-full bg-zinc-800" />}
              <div className="flex-1 min-w-0">
                <div className="text-sm text-zinc-200 font-bold truncate">{name}</div>
                {email && <div className="text-xs text-zinc-500 truncate">{email}</div>}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

// --- Picker Section ---
function PickerSection({ token }: { token: string }) {
  const [pickedFile, setPickedFile] = useState<any>(null);

  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://apis.google.com/js/api.js';
    script.onload = () => {
      (window as any).gapi.load('picker', () => {
        console.log('Picker loaded');
      });
    };
    document.body.appendChild(script);
    return () => { document.body.removeChild(script); };
  }, []);

  const openPicker = () => {
    if (!(window as any).google?.picker) {
      alert("Picker API not loaded yet. Try again in a moment.");
      return;
    }
    const pickerOrigin =
      window.location.ancestorOrigins &&
      window.location.ancestorOrigins.length > 0
        ? window.location.ancestorOrigins[window.location.ancestorOrigins.length - 1]
        : window.location.origin;

    const picker = new (window as any).google.picker.PickerBuilder()
      .addView((window as any).google.picker.ViewId.DOCS)
      .setOAuthToken(token)
      .setCallback((data: any) => {
        if (data.action === (window as any).google.picker.Action.PICKED) {
          const file = data.docs[0];
          setPickedFile(file);
        }
      })
      .setOrigin(pickerOrigin)
      .build();
    picker.setVisible(true);
  };

  return (
    <div className="p-6 h-full flex flex-col items-center justify-center space-y-4">
      <button onClick={openPicker} className="px-6 py-3 bg-white text-black font-bold uppercase text-xs hover:bg-zinc-200">
        Open Google Picker
      </button>
      {pickedFile && (
        <div className="mt-4 p-4 bg-zinc-900 border border-[var(--neon-green)] rounded w-full max-w-sm">
          <p className="text-sm text-zinc-300">Selected File:</p>
          <a href={pickedFile.url} target="_blank" rel="noreferrer" className="text-[var(--neon-green)] font-bold text-lg hover:underline truncate block">{pickedFile.name}</a>
        </div>
      )}
    </div>
  );
}
