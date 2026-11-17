import React, { useEffect, useMemo, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  ArrowRight, ArrowUpRight, Bell, Check, Heart, ImagePlus, Leaf, LogOut,
  MapPin, Plus, Search, ShieldCheck, Tag, X, MessageCircle, Flag,
  Users, Ban, CheckCircle2, Send, Handshake, AlertTriangle
} from 'lucide-react';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;
const categories = ['Todo', 'Con fotos', 'Río Grande', 'Tolhuin', 'Servicios'];
const reasons = ['Venta de dinero o precios', 'Contenido inapropiado', 'Posible estafa', 'Spam', 'Otro'];

function App() {
  const [session,setSession] = useState(null);
  const [profile,setProfile] = useState(null);
  const [listings,setListings] = useState([]);
  const [photos,setPhotos] = useState({});
  const [matches,setMatches] = useState([]);
  const [contacts,setContacts] = useState([]);
  const [proposals,setProposals] = useState([]);
  const [reports,setReports] = useState([]);
  const [notifications,setNotifications] = useState([]);
  const [members,setMembers] = useState([]);
  const [loading,setLoading] = useState(true);
  const [authMode,setAuthMode] = useState('login');
  const [authError,setAuthError] = useState('');
  const [authBusy,setAuthBusy] = useState(false);
  const [phone,setPhone] = useState('');
  const [password,setPassword] = useState('');
  const [groupCode,setGroupCode] = useState('');
  const [displayName,setDisplayName] = useState('');
  const [query,setQuery] = useState('');
  const [category,setCategory] = useState('Todo');
  const [page,setPage] = useState('explore');
  const [showCreate,setShowCreate] = useState(false);
  const [selectedListing,setSelectedListing] = useState(null);
  const [notice,setNotice] = useState('');
  const [saving,setSaving] = useState(false);
  const [reportTarget,setReportTarget] = useState(null);
  const [reportReason,setReportReason] = useState(reasons[0]);
  const [reportDetails,setReportDetails] = useState('');
  const [proposalText,setProposalText] = useState('');
  const [proposalOpen,setProposalOpen] = useState(false);
  const [form,setForm] = useState({title:'',description:'',looking_for:'',location:'Río Grande'});
  const [images,setImages] = useState([]);

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    supabase.auth.getSession().then(({data}) => setSession(data.session));
    const {data:{subscription}} = supabase.auth.onAuthStateChange((_event,next) => setSession(next));
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session || !supabase) {
      setProfile(null); setListings([]); setMatches([]); setContacts([]);
      setLoading(false); return;
    }
    loadData();
  }, [session]);

  useEffect(() => {
    if (!session || profile?.role !== 'admin') return;
    const refreshNotifications = async () => {
      const {data} = await supabase.from('admin_notifications').select('*').order('created_at',{ascending:false}).limit(30);
      setNotifications(data || []);
    };
    refreshNotifications();
    const timer = window.setInterval(refreshNotifications, 20000);
    return () => window.clearInterval(timer);
  }, [session, profile?.role]);

  async function loadData() {
    setLoading(true);
    const [{data:me},{data:rows,error}] = await Promise.all([
      supabase.from('profiles').select('id,display_name,role,is_active,created_at').eq('id',session.user.id).single(),
      supabase.from('listings').select('*, profiles(display_name), listing_images(id,storage_path,sort_order)').eq('status','published').order('created_at',{ascending:false})
    ]);
    setProfile(me || null);
    if (error) setNotice('No pudimos cargar las publicaciones. Revisá tu conexión.');
    const items = rows || [];
    setListings(items);
    const photoMap = {};
    await Promise.all(items.map(async item => {
      const ordered = (item.listing_images || []).sort((a,b)=>a.sort_order-b.sort_order);
      if (ordered[0]) {
        const {data} = await supabase.storage.from('listing-photos').createSignedUrl(ordered[0].storage_path,3600);
        if (data?.signedUrl) photoMap[item.id] = data.signedUrl;
      }
    }));
    setPhotos(photoMap);
    const [{data:matchRows},{data:contactRows},{data:proposalRows}] = await Promise.all([
      supabase.from('matches').select('*').or('user_one.eq.'+session.user.id+',user_two.eq.'+session.user.id).order('created_at',{ascending:false}),
      supabase.rpc('get_trueke_match_contacts'),
      supabase.from('direct_proposals').select('*').or('sender_id.eq.'+session.user.id+',recipient_id.eq.'+session.user.id).order('created_at',{ascending:false})
    ]);
    setMatches(matchRows || []);
    setContacts(contactRows || []);
    setProposals(proposalRows || []);
    if (me?.role === 'admin') {
      const [{data:reportRows},{data:notificationRows},{data:memberRows}] = await Promise.all([
        supabase.from('reports').select('*').order('created_at',{ascending:false}),
        supabase.from('admin_notifications').select('*').order('created_at',{ascending:false}).limit(30),
        supabase.rpc('admin_get_members')
      ]);
      setReports(reportRows || []);
      setNotifications(notificationRows || []);
      setMembers(memberRows || []);
    }
    setLoading(false);
  }

  async function handleAuth(e) {
    e.preventDefault(); setAuthError(''); setAuthBusy(true);
    try {
      const cleanPhone = phone.replace(/\D/g,'');
      if (!/^2964\d{6}$/.test(cleanPhone)) throw new Error('El usuario debe tener 10 números: 2964 y otros 6 números.');
      const phoneForAuth = '+549' + cleanPhone;
      const emailForAuth = cleanPhone + '@usuarios.trueke-prg.app';
      if (authMode === 'register') {
        const {data,error} = await supabase.functions.invoke('trueke-register',{body:{phone:phoneForAuth,email:emailForAuth,password,group_code:groupCode,display_name:displayName}});
        if (error || data?.error) throw new Error(data?.error || 'No se pudo completar el registro.');
        const {error:loginError} = await supabase.auth.signInWithPassword({email:emailForAuth,password});
        if (loginError) throw loginError;
      } else {
        const {error} = await supabase.auth.signInWithPassword({email:emailForAuth,password});
        if (error) throw error;
      }
    } catch(err) { setAuthError(err.message || 'Ocurrió un error. Intentá nuevamente.'); }
    finally { setAuthBusy(false); }
  }

  const filtered = useMemo(() => listings.filter(item => {
    const text = [item.title,item.description,item.looking_for,item.location,item.profiles?.display_name].join(' ').toLowerCase();
    const matchesText = text.includes(query.toLowerCase());
    const categoryMatch = category === 'Todo' || (category === 'Con fotos' ? (item.listing_images || []).length > 0 : category === 'Servicios' ? /servicio|clase|reparación|ayuda/i.test(text) : item.location?.toLowerCase().includes(category.toLowerCase()));
    return matchesText && categoryMatch;
  }),[listings,query,category]);

  function selectImages(files) { setImages(Array.from(files || []).slice(0,4)); }

  async function compressImage(file) {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1,1200/Math.max(bitmap.width,bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width*scale); canvas.height = Math.round(bitmap.height*scale);
    canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);
    return new Promise(resolve => canvas.toBlob(blob=>resolve(blob),'image/webp',0.8));
  }

  async function publishListing(e) {
    e.preventDefault();
    if (!form.title.trim() || !form.looking_for.trim()) return;
    setSaving(true); setNotice('');
    try {
      const {data:listing,error} = await supabase.from('listings').insert({
        user_id:session.user.id,title:form.title.trim(),description:form.description.trim(),
        looking_for:form.looking_for.trim(),location:form.location.trim(),status:'published'
      }).select().single();
      if (error) throw error;
      for (let i=0;i<images.length;i++) {
        const blob = await compressImage(images[i]);
        const path = session.user.id+'/'+listing.id+'/'+crypto.randomUUID()+'.webp';
        const {error:uploadError} = await supabase.storage.from('listing-photos').upload(path,blob,{contentType:'image/webp',upsert:false});
        if (uploadError) throw uploadError;
        const {error:rowError} = await supabase.from('listing_images').insert({listing_id:listing.id,user_id:session.user.id,storage_path:path,sort_order:i});
        if (rowError) throw rowError;
      }
      setShowCreate(false); setForm({title:'',description:'',looking_for:'',location:'Río Grande'}); setImages([]);
      setNotice('¡Publicación cargada! Ya está visible para todos los miembros.');
      await loadData();
    } catch(err) { setNotice(err.message || 'No se pudo publicar.'); }
    finally { setSaving(false); }
  }

  async function addInterest(item) {
    if (item.user_id === session.user.id) return;
    const {error} = await supabase.from('listing_interests').insert({listing_id:item.id,user_id:session.user.id});
    if (error && !String(error.message).includes('duplicate')) setNotice(error.message);
    else setNotice('Interés registrado. Si la otra persona también se interesa por una de tus publicaciones, tendrán un match.');
    await loadData();
  }

  async function sendProposal(e) {
    e.preventDefault();
    if (!selectedListing || !proposalText.trim()) return;
    const {error} = await supabase.from('direct_proposals').insert({
      listing_id:selectedListing.id,sender_id:session.user.id,recipient_id:selectedListing.user_id,message:proposalText.trim()
    });
    if (error) setNotice(error.message);
    else { setNotice('Propuesta enviada.'); setProposalOpen(false); setProposalText(''); await loadData(); }
  }

  async function acceptProposal(id) {
    const {error} = await supabase.rpc('accept_trueke_proposal',{p_proposal_id:id});
    if (error) setNotice(error.message);
    else { setNotice('¡Propuesta aceptada! Ya tienen un match.'); await loadData(); }
  }

  async function submitReport(e) {
    e.preventDefault();
    if (!reportTarget) return;
    const {error} = await supabase.from('reports').insert({
      reporter_id:session.user.id,listing_id:reportTarget.listingId || null,
      reported_user:reportTarget.userId || null,reason:reportReason,details:reportDetails.trim()
    });
    if (error) setNotice(error.message);
    else { setNotice('Denuncia enviada. Gracias por ayudar a cuidar la comunidad.'); setReportTarget(null); setReportDetails(''); await loadData(); }
  }

  async function setMemberActive(member,active) {
    const action = active ? 'habilitar' : 'bloquear';
    if (!window.confirm('¿Querés '+action+' a '+member.display_name+'?')) return;
    const {error} = await supabase.rpc('admin_set_member_active',{p_user_id:member.id,p_active:active});
    if (error) setNotice(error.message);
    else { setNotice(active?'Miembro habilitado.':'Miembro bloqueado y sus publicaciones pausadas.'); await loadData(); }
  }

  async function updateReport(report,status) {
    const {error} = await supabase.from('reports').update({status}).eq('id',report.id);
    if (error) setNotice(error.message); else { setNotice('Denuncia actualizada.'); await loadData(); }
  }

  async function markNotificationsRead() {
    const unread = notifications.filter(n=>!n.read_at);
    if (!unread.length) return;
    await supabase.from('admin_notifications').update({read_at:new Date().toISOString()}).in('id',unread.map(n=>n.id));
    await loadData();
  }

  async function logout() { await supabase.auth.signOut(); }

  if (!supabase) return <div className="setup"><div className="brand-mark"><Leaf size={22}/></div><h1>Falta conectar Trueke PRG</h1><p>Configurá VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY para iniciar.</p></div>;

  if (session && profile && profile.is_active === false) return <main className="setup"><div className="brand-mark"><ShieldCheck size={22}/></div><h1>Acceso suspendido</h1><p>Tu cuenta está bloqueada por administración. Si creés que es un error, contactá al administrador de Trueke PRG.</p><button className="primary-btn" onClick={logout}>Cerrar sesión</button></main>;

  if (!session) return <main className="auth-shell">
    <section className="auth-art">
      <div className="auth-brand"><div className="brand-mark"><Leaf size={23}/></div><span>TRUEKE <b>PRG</b></span></div>
      <div className="art-copy"><span className="eyebrow light">UNA COMUNIDAD QUE COMPARTE</span><h1>Lo que tenés,<br/><em>vale por lo que</em><br/>necesitás.</h1><p>Un lugar para intercambiar cosas, saberes y servicios entre nosotros. Sin plata. Sin vueltas.</p></div>
      <div className="art-footer"><span>Intercambios con sentido.</span><span>01 — Comunidad PRG</span></div>
      <div className="art-orbit orbit-one"></div><div className="art-orbit orbit-two"></div>
    </section>
    <section className="auth-panel">
      <div className="mobile-brand"><div className="brand-mark"><Leaf size={22}/></div><span>TRUEKE <b>PRG</b></span></div>
      <div className="auth-card">
        <span className="eyebrow">{authMode==='login'?'QUÉ BUENO VERTE':'SUMATE A LA COMUNIDAD'}</span>
        <h2>{authMode==='login'?'Entrá a tu comunidad':'Creá tu cuenta'}</h2>
        <p className="muted">{authMode==='login'?'Ingresá con tu teléfono y contraseña.':'El acceso es privado para miembros autorizados.'}</p>
        <form onSubmit={handleAuth}>
          {authMode==='register' && <label>Cómo te llamás<input value={displayName} onChange={e=>setDisplayName(e.target.value)} placeholder="Tu nombre" required maxLength={60}/></label>}
          <label>Teléfono (tu usuario)<input type="tel" inputMode="numeric" value={phone} onChange={e=>setPhone(e.target.value.replace(/\D/g,'').slice(0,10))} placeholder="2964XXXXXX" autoComplete="tel" maxLength={10} minLength={10} pattern="2964[0-9]{6}" required/><small>Usá 2964 seguido de 6 números.</small></label>
          <label>Contraseña<input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Mínimo 8 caracteres" autoComplete={authMode==='login'?'current-password':'new-password'} minLength={8} required/></label>
          {authMode==='register' && <label>Código privado del grupo<input value={groupCode} onChange={e=>setGroupCode(e.target.value.toUpperCase())} placeholder="Código de acceso" required autoComplete="off"/></label>}
          {authError && <div className="error-box">{authError}</div>}
          <button className="primary-btn full" disabled={authBusy}>{authBusy?'Un momento…':authMode==='login'?'Ingresar a Trueke':'Crear mi cuenta'} <ArrowRight size={17}/></button>
        </form>
        <div className="auth-switch">{authMode==='login'?'¿Ya tenés acceso al grupo?':'¿Ya tenés cuenta?'} <button onClick={()=>{setAuthMode(authMode==='login'?'register':'login');setAuthError('')}}>{authMode==='login'?'Crear cuenta':'Iniciar sesión'}</button></div>
        <div className="privacy-note"><ShieldCheck size={16}/> Acceso privado para miembros autorizados.</div>
      </div>
      <div className="panel-bottom">TRUEKE PRG <span>·</span> Intercambiar nos acerca</div>
    </section>
  </main>;

  const unreadCount = notifications.filter(n=>!n.read_at).length;
  const contactMap = Object.fromEntries(contacts.map(c=>[c.match_id,c]));
  const incoming = proposals.filter(p=>p.recipient_id===session.user.id && p.status==='pending');
  const outgoing = proposals.filter(p=>p.sender_id===session.user.id);

  return <div className="app-shell">
    <header className="topbar">
      <a className="brand" href="#" onClick={()=>setPage('explore')}><div className="brand-mark"><Leaf size={21}/></div><span>TRUEKE <b>PRG</b></span></a>
      <nav className="desktop-nav">
        <button className={page==='explore'?'nav-button active':'nav-button'} onClick={()=>setPage('explore')}>Explorar</button>
        <button className={page==='matches'?'nav-button active':'nav-button'} onClick={()=>setPage('matches')}>Mis matches <span className="nav-count">{matches.length}</span></button>
        {profile?.role==='admin'&&<button className={page==='admin'?'nav-button active':'nav-button'} onClick={()=>setPage('admin')}>Administración {unreadCount>0&&<span className="nav-count alert-count">{unreadCount}</span>}</button>}
      </nav>
      <div className="top-actions"><button className="icon-btn" aria-label="Notificaciones" onClick={()=>profile?.role==='admin'?setPage('admin'):setPage('matches')}><Bell size={19}/>{unreadCount>0&&<i className="notification-dot"/>}</button><div className="user-chip"><div className="avatar">{(profile?.display_name||'U').slice(0,1).toUpperCase()}</div><span>{profile?.display_name||'Mi cuenta'}</span>{profile?.role==='admin'&&<span className="admin-pill">ADMIN</span>}</div><button className="icon-btn" onClick={logout} title="Cerrar sesión"><LogOut size={18}/></button></div>
    </header>
    <main>
      {page==='explore'&&<>
        <section className="welcome-hero"><div className="hero-text"><span className="eyebrow light">✦ EL VALOR ESTÁ EN COMPARTIR</span><h1>Un buen intercambio<br/><em>nos sirve a todos.</em></h1><p>Encontrá eso que necesitás. Ofrecé eso que ya no usás.</p><button className="hero-btn" onClick={()=>setShowCreate(true)}><Plus size={18}/> Publicar un trueque</button></div><div className="hero-visual"><div className="sun-disc"></div><div className="floating-note note-a"><span>YO TENGO</span><b>Una bici 🚲</b></div><div className="swap-mark">↔</div><div className="floating-note note-b"><span>YO BUSCO</span><b>Una guitarra 🎸</b></div><div className="hero-stamp"><Leaf size={17}/><span>Sin dinero.<br/>Con valor.</span></div></div></section>
        <section className="explore-section" id="explorar">
          <div className="section-heading"><div><span className="eyebrow">LA COMUNIDAD EN MOVIMIENTO</span><h2>Encontrá tu próximo trueque</h2><p>Objetos, habilidades y servicios. Todo se puede intercambiar.</p></div><button className="outline-btn desktop-publish" onClick={()=>setShowCreate(true)}><Plus size={17}/> Publicar algo</button></div>
          <div className="search-row"><div className="search-box"><Search size={19}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="¿Qué estás buscando?"/></div></div>
          <div className="category-row">{categories.map(c=><button key={c} onClick={()=>setCategory(c)} className={category===c?'category active':'category'}>{c}</button>)}</div>
          {notice&&<div className="notice"><Check size={16}/>{notice}<button onClick={()=>setNotice('')}><X size={15}/></button></div>}
          {loading?<div className="loading">Cargando los trueques de la comunidad…</div>:<div className="listing-grid">{filtered.length?filtered.map((item,index)=><article className="listing-card" key={item.id}>
            <div className={'listing-photo photo-'+(index%4)}>{photos[item.id]?<img src={photos[item.id]} alt={item.title}/>:<div className="photo-placeholder"><Tag size={31}/><span>TRUEQUE</span></div>}<span className="photo-tag">DISPONIBLE</span></div>
            <div className="listing-info"><div className="listing-meta"><span><MapPin size={13}/>{item.location||'Ubicación a coordinar'}</span><span>{new Date(item.created_at).toLocaleDateString('es-AR',{day:'numeric',month:'short'})}</span></div><h3>{item.title}</h3><p>{item.description||'Sin descripción adicional.'}</p><div className="swap-for"><span>BUSCA A CAMBIO</span><b>{item.looking_for}</b></div><div className="card-footer"><div className="seller"><div className="mini-avatar">{(item.profiles?.display_name||'U').slice(0,1).toUpperCase()}</div><span>{item.profiles?.display_name||'Miembro'}</span></div><div className="card-actions"><button className="interest-btn" onClick={()=>addInterest(item)} disabled={item.user_id===session.user.id}><Heart size={15}/> Me interesa</button><button className="view-link" onClick={()=>setSelectedListing(item)}>Ver <ArrowUpRight size={16}/></button></div></div></div>
          </article>):<div className="empty-state"><Search size={28}/><h3>No encontramos coincidencias</h3><p>Probá con otra búsqueda o publicá lo que querés intercambiar.</p><button className="primary-btn" onClick={()=>setShowCreate(true)}>Publicar un trueque <ArrowRight size={16}/></button></div>}</div>}
        </section>
      </>}
      {page==='matches'&&<section className="dashboard-section"><span className="eyebrow">TUS CONEXIONES</span><h1>Mis matches</h1><p className="muted">Cuando dos personas se interesan mutuamente, pueden coordinar por WhatsApp.</p>
        {matches.length===0&&<div className="empty-state"><Handshake size={34}/><h3>Todavía no tenés matches</h3><p>Marcá «Me interesa» en publicaciones. Si la otra persona también se interesa por algo tuyo, aparecerá acá.</p></div>}
        <div className="match-list">{matches.map(m=>{const c=contactMap[m.id];return <article className="match-card" key={m.id}><div className="match-avatar">{(c?.display_name||'M').slice(0,1).toUpperCase()}</div><div className="match-info"><b>{c?.display_name||'Miembro de Trueke'}</b><small>Match confirmado · {new Date(m.created_at).toLocaleDateString('es-AR')}</small><span>{c?.phone||'Contacto protegido'}</span></div>{c?.phone&&<a className="whatsapp-btn" href={'https://wa.me/'+c.phone.replace(/\D/g,'')} target="_blank" rel="noreferrer"><MessageCircle size={17}/> Abrir chat</a>}</article>})}</div>
        {incoming.length>0&&<><h2 className="subheading">Propuestas recibidas</h2>{incoming.map(p=><article className="proposal-card" key={p.id}><div><b>Propuesta directa</b><p>{p.message}</p><small>{new Date(p.created_at).toLocaleDateString('es-AR')}</small></div><button className="primary-btn" onClick={()=>acceptProposal(p.id)}><CheckCircle2 size={16}/> Aceptar y hacer match</button></article>)}</>}
        {outgoing.length>0&&<><h2 className="subheading">Propuestas enviadas</h2>{outgoing.map(p=><article className="proposal-card" key={p.id}><div><b>{p.status==='accepted'?'Aceptada':p.status==='rejected'?'Rechazada':'Pendiente'}</b><p>{p.message}</p></div></article>)}</>}
      </section>}
      {page==='admin'&&profile?.role==='admin'&&<section className="dashboard-section"><span className="eyebrow">PANEL PRIVADO</span><h1>Administración</h1><p className="muted">Moderá la comunidad y revisá los avisos de los miembros.</p>
        <div className="admin-stats"><div><strong>{reports.filter(r=>r.status==='open').length}</strong><span>Denuncias pendientes</span></div><div><strong>{members.length}</strong><span>Miembros registrados</span></div><div><strong>{members.filter(m=>!m.is_active).length}</strong><span>Bloqueados</span></div></div>
        <div className="admin-section-head"><h2><Flag size={19}/> Denuncias</h2><button className="outline-btn" onClick={markNotificationsRead}>Marcar avisos leídos</button></div>
        {reports.length===0?<p className="muted">Todavía no hay denuncias.</p>:reports.map(r=><article className="report-card" key={r.id}><div className="report-main"><span className={'status-pill '+r.status}>{r.status==='open'?'Pendiente':r.status==='reviewed'?'Revisada':'Cerrada'}</span><b>{r.reason}</b><p>{r.details||'Sin detalles adicionales.'}</p><small>{new Date(r.created_at).toLocaleString('es-AR')} · Publicación/usuario: {r.listing_id||r.reported_user||'—'}</small></div><div className="report-actions"><button onClick={()=>updateReport(r,'reviewed')}>Revisada</button><button onClick={()=>updateReport(r,'closed')}>Cerrar</button></div></article>)}
        <div className="admin-section-head"><h2><Users size={19}/> Miembros</h2></div>
        <div className="member-list">{members.map(m=><article className="member-row" key={m.id}><div className="member-avatar">{(m.display_name||'U').slice(0,1).toUpperCase()}</div><div className="member-info"><b>{m.display_name||'Sin nombre'}</b><span>{m.phone}</span></div><span className={m.is_active?'member-state active':'member-state blocked'}>{m.is_active?'Activo':'Bloqueado'}</span>{m.role!=='admin'&&<button className={m.is_active?'ban-btn':'unban-btn'} onClick={()=>setMemberActive(m,!m.is_active)}>{m.is_active?<><Ban size={15}/> Bloquear</>:<><CheckCircle2 size={15}/> Habilitar</>}</button>}</article>)}</div>
        <div className="admin-section-head"><h2><Bell size={19}/> Avisos recientes</h2></div>
        {notifications.slice(0,8).map(n=><article className="notification-row" key={n.id}><span className={n.read_at?'read-dot':'unread-dot'}/><div><b>{n.title}</b><p>{n.body}</p><small>{new Date(n.created_at).toLocaleString('es-AR')}</small></div></article>)}
      </section>}
    </main>
    <footer className="footer"><a className="brand" href="#"><div className="brand-mark"><Leaf size={18}/></div><span>TRUEKE <b>PRG</b></span></a><span>Una comunidad. Muchas posibilidades.</span><span>© 2026 Trueke PRG</span></footer>

    {selectedListing&&<div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setSelectedListing(null)}}><div className="create-modal detail-modal"><div className="modal-head"><div><span className="eyebrow">DETALLE DEL INTERCAMBIO</span><h2>{selectedListing.title}</h2><p><MapPin size={13} style={{display:'inline',verticalAlign:'middle'}}/> {selectedListing.location||'Ubicación a coordinar'}</p></div><button className="icon-btn" onClick={()=>setSelectedListing(null)}><X/></button></div>{photos[selectedListing.id]&&<img className="detail-image" src={photos[selectedListing.id]} alt={selectedListing.title}/>}<div className="detail-copy"><span className="eyebrow">QUÉ OFRECE</span><p>{selectedListing.description||'El miembro no agregó detalles adicionales.'}</p><div className="swap-for"><span>BUSCA A CAMBIO</span><b>{selectedListing.looking_for}</b></div><div className="detail-owner"><div className="mini-avatar">{(selectedListing.profiles?.display_name||'U').slice(0,1).toUpperCase()}</div><span>Publicado por <b>{selectedListing.profiles?.display_name||'Miembro'}</b></span></div><div className="detail-buttons"><button className="interest-btn" onClick={()=>{addInterest(selectedListing);setSelectedListing(null)}}><Heart size={16}/> Me interesa</button>{selectedListing.user_id!==session.user.id&&<button className="primary-btn" onClick={()=>setProposalOpen(true)}><Send size={16}/> Proponer intercambio</button>}<button className="report-link" onClick={()=>{setReportTarget({listingId:selectedListing.id,userId:selectedListing.user_id});setSelectedListing(null)}}><Flag size={15}/> Reportar</button></div></div></div></div>}
    {proposalOpen&&selectedListing&&<div className="modal-backdrop"><div className="create-modal"><div className="modal-head"><div><span className="eyebrow">PROPUESTA DIRECTA</span><h2>Proponer un intercambio</h2><p>{selectedListing.title}</p></div><button className="icon-btn" onClick={()=>setProposalOpen(false)}><X/></button></div><form className="create-form" onSubmit={sendProposal}><label>Tu propuesta<textarea value={proposalText} onChange={e=>setProposalText(e.target.value)} rows={4} maxLength={1500} placeholder="Contale qué podés ofrecer a cambio…" required/></label><button className="primary-btn" disabled={!proposalText.trim()}>Enviar propuesta <ArrowRight size={16}/></button></form></div></div>}
    {reportTarget&&<div className="modal-backdrop"><div className="create-modal"><div className="modal-head"><div><span className="eyebrow">CUIDEMOS LA COMUNIDAD</span><h2>Reportar contenido</h2><p>La denuncia llegará al administrador.</p></div><button className="icon-btn" onClick={()=>setReportTarget(null)}><X/></button></div><form className="create-form" onSubmit={submitReport}><label>Motivo<select value={reportReason} onChange={e=>setReportReason(e.target.value)}>{reasons.map(r=><option key={r}>{r}</option>)}</select></label><label>Detalles (opcional)<textarea value={reportDetails} onChange={e=>setReportDetails(e.target.value)} rows={3} maxLength={1000} placeholder="Contanos qué pasó…"/></label><button className="primary-btn">Enviar denuncia <Flag size={16}/></button></form></div></div>}
    {showCreate&&<div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setShowCreate(false)}}><div className="create-modal"><div className="modal-head"><div><span className="eyebrow">HACÉ CIRCULAR LO QUE TENÉS</span><h2>Publicá tu trueque</h2><p>Una sola publicación para objetos, servicios o habilidades.</p></div><button className="icon-btn" onClick={()=>setShowCreate(false)}><X/></button></div><form onSubmit={publishListing} className="create-form">
      <label>¿Qué ofrecés?<input value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="Ej. Bicicleta rodado 29" maxLength={100} required/></label>
      <label>Contá un poco más<textarea value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder="Estado, medidas, detalles o cómo es el servicio…" rows={3} maxLength={1000}/></label>
      <label>¿Qué te gustaría recibir a cambio?<input value={form.looking_for} onChange={e=>setForm({...form,looking_for:e.target.value})} placeholder="Ej. Una mesa, clases de inglés, ayuda…" maxLength={300} required/></label>
      <label>¿Dónde estás? <input value={form.location} onChange={e=>setForm({...form,location:e.target.value})} placeholder="Río Grande, Tolhuin…" maxLength={100}/></label>
      <div className="upload-area"><label className="upload-label"><ImagePlus size={20}/><span><b>Sumá fotos</b><small>Hasta 4 imágenes · se optimizan automáticamente</small></span><input type="file" accept="image/*" multiple onChange={e=>selectImages(e.target.files)} hidden/></label><div className="image-count">{images.length}/4</div></div>
      {images.length>0&&<div className="selected-files">{images.map((f,i)=><span key={i}>{f.name}<button type="button" onClick={()=>setImages(images.filter((_,j)=>j!==i))}><X size={13}/></button></span>)}</div>}
      <div className="form-foot"><span><ShieldCheck size={15}/> Publicación automática para todos los miembros.</span><button className="primary-btn" disabled={saving}>{saving?'Publicando…':'Publicar trueque'} <ArrowRight size={16}/></button></div>
    </form></div></div>}
  </div>;
}

export default App;
