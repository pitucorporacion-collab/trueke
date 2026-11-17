import React, { useEffect, useMemo, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { ArrowRight, ArrowUpRight, Bell, Camera, Check, ChevronDown, CircleHelp, Heart, ImagePlus, Leaf, LogOut, MapPin, Menu, Plus, Search, ShieldCheck, SlidersHorizontal, Sparkles, Tag, X } from 'lucide-react';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

const categories = ['Todo', 'Con fotos', 'Río Grande', 'Tolhuin', 'Servicios'];
const demoListings = [
  { id:'demo-1', title:'Bicicleta rodado 29', description:'En buen estado, lista para usar. Tiene algunos detalles de uso.', looking_for:'Una mesa de comedor o herramientas.', location:'Río Grande', created_at:new Date().toISOString(), profiles:{display_name:'Mariano'}, category:'Deportes', demo:true },
  { id:'demo-2', title:'Clases de guitarra', description:'Clases para principiantes. Acordamos días y horarios.', looking_for:'Ayuda con pintura o arreglos del hogar.', location:'Río Grande', created_at:new Date().toISOString(), profiles:{display_name:'Sofi'}, category:'Servicios', demo:true },
  { id:'demo-3', title:'Taladro percutor', description:'Funciona perfecto. Incluye mandril y maletín.', looking_for:'Una silla de escritorio o una cafetera.', location:'Tolhuin', created_at:new Date().toISOString(), profiles:{display_name:'Pablo'}, category:'Herramientas', demo:true },
];

function App() {
  const [session,setSession] = useState(null);
  const [profile,setProfile] = useState(null);
  const [listings,setListings] = useState([]);
  const [photos,setPhotos] = useState({});
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
  const [showCreate,setShowCreate] = useState(false);
  const [selectedListing,setSelectedListing] = useState(null);
  const [notice,setNotice] = useState('');
  const [saving,setSaving] = useState(false);
  const [form,setForm] = useState({title:'',description:'',looking_for:'',location:'Río Grande'});
  const [images,setImages] = useState([]);

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    supabase.auth.getSession().then(({data}) => setSession(data.session));
    const {data:{subscription}} = supabase.auth.onAuthStateChange((_event,next) => setSession(next));
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session || !supabase) { setProfile(null); setListings([]); setLoading(false); return; }
    loadData();
  }, [session]);

  async function loadData() {
    setLoading(true);
    const [{data:me},{data:rows,error}] = await Promise.all([
      supabase.from('profiles').select('*').eq('id',session.user.id).single(),
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
    setLoading(false);
  }

  async function handleAuth(e) {
    e.preventDefault(); setAuthError(''); setAuthBusy(true);
    try {
      const cleanPhone = phone.trim().replace(/\D/g,'');
      const phoneForAuth = authMode === 'register' ? '+' + cleanPhone : cleanPhone;
      if (authMode === 'register') {
        const {data,error} = await supabase.functions.invoke('trueke-register',{body:{phone:phoneForAuth,password,group_code:groupCode,display_name:displayName}});
        if (error || data?.error) throw new Error(data?.error || 'No se pudo completar el registro.');
        const {error:loginError} = await supabase.auth.signInWithPassword({phone:phoneForAuth,password});
        if (loginError) throw loginError;
      } else {
        let {error} = await supabase.auth.signInWithPassword({phone:cleanPhone,password});
        if (error) ({error} = await supabase.auth.signInWithPassword({phone:`+${cleanPhone}`,password}));
        if (error) throw error;
      }
    } catch(err) { setAuthError(err.message || 'Ocurrió un error. Intentá nuevamente.'); }
    finally { setAuthBusy(false); }
  }

  const filtered = useMemo(() => listings.filter(item => {
    const text = [item.title,item.description,item.looking_for,item.location,item.profiles?.display_name].join(' ').toLowerCase();
    const matches = text.includes(query.toLowerCase());
    const categoryMatch = category === 'Todo' || (category === 'Con fotos' ? (item.listing_images || []).length > 0 : category === 'Servicios' ? /servicio|clase|reparación|ayuda/i.test(text) : item.location?.toLowerCase().includes(category.toLowerCase()));
    return matches && categoryMatch;
  }),[listings,query,category]);

  function selectImages(files) {
    const chosen = Array.from(files || []).slice(0,4);
    setImages(chosen);
  }

  async function compressImage(file) {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1,1200/Math.max(bitmap.width,bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width*scale); canvas.height = Math.round(bitmap.height*scale);
    canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);
    return new Promise(resolve => canvas.toBlob(blob=>resolve(blob),'image/webp',0.8));
  }

  async function publishListing(e) {
    e.preventDefault(); if (!form.title.trim() || !form.looking_for.trim()) return;
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
      setNotice('¡Publicación cargada! Ya está visible para el grupo.');
      await loadData();
    } catch(err) { setNotice(err.message || 'No se pudo publicar.'); }
    finally { setSaving(false); }
  }

  async function logout() { await supabase.auth.signOut(); }

  if (!supabase) return <div className="setup"><div className="brand-mark"><Leaf size={22}/></div><h1>Falta conectar Trueke PRG</h1><p>Configurá VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY para iniciar.</p></div>;

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
          <label>Teléfono (tu usuario)<input type="tel" inputMode="tel" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="549296..." autoComplete="tel" required/><small>Ingresalo con código de país. Podés escribirlo con o sin +, espacios o guiones.</small></label>
          <label>Contraseña<input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Mínimo 8 caracteres" autoComplete={authMode==='login'?'current-password':'new-password'} minLength={8} required/></label>
          {authMode==='register' && <label>Código privado del grupo<input value={groupCode} onChange={e=>setGroupCode(e.target.value.toUpperCase())} placeholder="Código de acceso" required autoComplete="off"/></label>}
          {authError && <div className="error-box">{authError}</div>}
          <button className="primary-btn full" disabled={authBusy}>{authBusy?'Un momento…':authMode==='login'?'Ingresar a Trueke':'Crear mi cuenta'} <ArrowRight size={17}/></button>
        </form>
        <div className="auth-switch">{authMode==='login'?'¿Ya tenés acceso al grupo?':'¿Ya tenés cuenta?'} <button onClick={()=>{setAuthMode(authMode==='login'?'register':'login');setAuthError('')}}>{authMode==='login'?'Crear cuenta':'Iniciar sesión'}</button></div>
        <div className="privacy-note"><ShieldCheck size={16}/> Acceso privado. Tus datos solo son visibles para la comunidad.</div>
      </div>
      <div className="panel-bottom">TRUEKE PRG <span>·</span> Intercambiar nos acerca</div>
    </section>
  </main>;

  return <div className="app-shell">
    <header className="topbar">
      <a className="brand" href="#"><div className="brand-mark"><Leaf size={21}/></div><span>TRUEKE <b>PRG</b></span></a>
      <nav className="desktop-nav"><a className="active" href="#explorar">Explorar</a><a href="#como-funciona">Cómo funciona</a></nav>
      <div className="top-actions"><button className="icon-btn" aria-label="Notificaciones"><Bell size={19}/></button><div className="user-chip"><div className="avatar">{(profile?.display_name||'U').slice(0,1).toUpperCase()}</div><span>{profile?.display_name||'Mi cuenta'}</span>{profile?.role==='admin'&&<span className="admin-pill">ADMIN</span>}</div><button className="icon-btn" onClick={logout} title="Cerrar sesión"><LogOut size={18}/></button></div>
    </header>
    <main>
      <section className="welcome-hero">
        <div className="hero-text"><span className="eyebrow light"><Sparkles size={13}/> EL VALOR ESTÁ EN COMPARTIR</span><h1>Un buen intercambio<br/><em>nos sirve a todos.</em></h1><p>Encontrá eso que necesitás. Ofrecé eso que ya no usás.</p><button className="hero-btn" onClick={()=>setShowCreate(true)}><Plus size={18}/> Publicar un trueque</button></div>
        <div className="hero-visual"><div className="sun-disc"></div><div className="floating-note note-a"><span>YO TENGO</span><b>Una bici 🚲</b></div><div className="swap-mark">↔</div><div className="floating-note note-b"><span>YO BUSCO</span><b>Una guitarra 🎸</b></div><div className="hero-stamp"><Leaf size={17}/><span>Sin dinero.<br/>Con valor.</span></div></div>
      </section>
      <section className="explore-section" id="explorar">
        <div className="section-heading"><div><span className="eyebrow">LA COMUNIDAD EN MOVIMIENTO</span><h2>Encontrá tu próximo trueque</h2><p>Objetos, habilidades y servicios. Todo se puede intercambiar.</p></div><button className="outline-btn desktop-publish" onClick={()=>setShowCreate(true)}><Plus size={17}/> Publicar algo</button></div>
        <div className="search-row"><div className="search-box"><Search size={19}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="¿Qué estás buscando?"/></div><button className="filter-btn"><SlidersHorizontal size={17}/> Filtros <ChevronDown size={15}/></button></div>
        <div className="category-row">{categories.map(c=><button key={c} onClick={()=>setCategory(c)} className={category===c?'category active':'category'}>{c}</button>)}</div>
        {notice && <div className="notice"><Check size={16}/>{notice}<button onClick={()=>setNotice('')}><X size={15}/></button></div>}
        {loading ? <div className="loading">Cargando los trueques de la comunidad…</div> :
          <div className="listing-grid">{filtered.length ? filtered.map((item,index)=><article className="listing-card" key={item.id}>
            <div className={'listing-photo photo-'+(index%4)}>{photos[item.id]?<img src={photos[item.id]} alt={item.title}/>:<div className="photo-placeholder"><Tag size={31}/><span>TRUEQUE</span></div>}<button className="save-btn" aria-label="Guardar"><Heart size={17}/></button><span className="photo-tag">DISPONIBLE</span></div>
            <div className="listing-info"><div className="listing-meta"><span><MapPin size={13}/>{item.location||'Ubicación a coordinar'}</span><span>{new Date(item.created_at).toLocaleDateString('es-AR',{day:'numeric',month:'short'})}</span></div><h3>{item.title}</h3><p>{item.description||'Sin descripción adicional.'}</p><div className="swap-for"><span>BUSCA A CAMBIO</span><b>{item.looking_for}</b></div><div className="card-footer"><div className="seller"><div className="mini-avatar">{(item.profiles?.display_name||'U').slice(0,1).toUpperCase()}</div><span>{item.profiles?.display_name||'Miembro'}</span></div><button className="view-link" onClick={()=>setSelectedListing(item)}>Ver trueque <ArrowUpRight size={16}/></button></div></div>
          </article>) : <div className="empty-state"><Search size={28}/><h3>No encontramos coincidencias</h3><p>Probá con otra búsqueda o publicá lo que querés intercambiar.</p><button className="primary-btn" onClick={()=>setShowCreate(true)}>Publicar un trueque <ArrowRight size={16}/></button></div>}</div>
        }
      </section>
      <section className="how-section" id="como-funciona"><div><span className="eyebrow">ASÍ DE SIMPLE</span><h2>Intercambiar es fácil.</h2></div><div className="steps"><div><span>01</span><h3>Publicá</h3><p>Contá qué tenés y qué te gustaría recibir.</p></div><div><span>02</span><h3>Conectá</h3><p>Encontrá a alguien que tenga lo que buscás.</p></div><div><span>03</span><h3>Acuerden</h3><p>Coordinen el intercambio entre ustedes.</p></div></div></section>
    </main>
    <footer className="footer"><a className="brand" href="#"><div className="brand-mark"><Leaf size={18}/></div><span>TRUEKE <b>PRG</b></span></a><span>Una comunidad. Muchas posibilidades.</span><span>© 2026 Trueke PRG</span></footer>
    {selectedListing && <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setSelectedListing(null)}}><div className="create-modal detail-modal"><div className="modal-head"><div><span className="eyebrow">DETALLE DEL INTERCAMBIO</span><h2>{selectedListing.title}</h2><p><MapPin size={13} style={{display:'inline',verticalAlign:'middle'}}/> {selectedListing.location||'Ubicación a coordinar'}</p></div><button className="icon-btn" onClick={()=>setSelectedListing(null)}><X/></button></div>{photos[selectedListing.id]&&<img className="detail-image" src={photos[selectedListing.id]} alt={selectedListing.title}/>}<div className="detail-copy"><span className="eyebrow">QUÉ OFRECE</span><p>{selectedListing.description||'El miembro no agregó detalles adicionales.'}</p><div className="swap-for"><span>BUSCA A CAMBIO</span><b>{selectedListing.looking_for}</b></div><div className="detail-owner"><div className="mini-avatar">{(selectedListing.profiles?.display_name||'U').slice(0,1).toUpperCase()}</div><span>Publicado por <b>{selectedListing.profiles?.display_name||'Miembro'}</b></span></div><p className="detail-hint">Para coordinar el intercambio, contactá al miembro por los medios habituales del grupo.</p></div></div></div>}
    {showCreate && <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setShowCreate(false)}}><div className="create-modal"><div className="modal-head"><div><span className="eyebrow">HACÉ CIRCULAR LO QUE TENÉS</span><h2>Publicá tu trueque</h2><p>Una sola publicación para objetos, servicios o habilidades.</p></div><button className="icon-btn" onClick={()=>setShowCreate(false)}><X/></button></div><form onSubmit={publishListing} className="create-form">
      <label>¿Qué ofrecés?<input value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="Ej. Bicicleta rodado 29" maxLength={100} required/></label>
      <label>Contá un poco más<textarea value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder="Estado, medidas, detalles o cómo es el servicio…" rows={3} maxLength={1000}/></label>
      <label>¿Qué te gustaría recibir a cambio?<input value={form.looking_for} onChange={e=>setForm({...form,looking_for:e.target.value})} placeholder="Ej. Una mesa, clases de inglés, ayuda…" maxLength={300} required/></label>
      <label>¿Dónde estás? <input value={form.location} onChange={e=>setForm({...form,location:e.target.value})} placeholder="Río Grande, Tolhuin…" maxLength={100}/></label>
      <div className="upload-area"><label className="upload-label"><ImagePlus size={20}/><span><b>Sumá fotos</b><small>Hasta 4 imágenes · se optimizan automáticamente</small></span><input type="file" accept="image/*" multiple onChange={e=>selectImages(e.target.files)} hidden/></label><div className="image-count">{images.length}/4</div></div>
      {images.length>0&&<div className="selected-files">{images.map((f,i)=><span key={i}>{f.name}<button type="button" onClick={()=>setImages(images.filter((_,j)=>j!==i))}><X size={13}/></button></span>)}</div>}
      <div className="form-foot"><span><ShieldCheck size={15}/> Solo miembros del grupo pueden ver las publicaciones.</span><button className="primary-btn" disabled={saving}>{saving?'Publicando…':'Publicar trueque'} <ArrowRight size={16}/></button></div>
    </form></div></div>}
  </div>;
}

export default App;