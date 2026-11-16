import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const db = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;
const demoSeed = [
  { id:"demo-1", display_name:"María", offer:"Mesa de madera en buen estado", looking_for:"Una bicicleta o algo de jardinería", description:"Mesa firme, ideal para comedor. Se retira por Río Grande.", image_url:"", user_id:"demo-maria" },
  { id:"demo-2", display_name:"Carlos", offer:"Herramientas para trabajos de electricidad", looking_for:"Muebles o ayuda con jardinería", description:"Tengo herramientas manuales y algunas eléctricas en buen estado.", image_url:"", user_id:"demo-carlos" },
  { id:"demo-3", display_name:"Lucía", offer:"Plantas de interior y macetas", looking_for:"Libros, estantes o artículos para el hogar", description:"Puedo acercarlas dentro de Río Grande.", image_url:"", user_id:"demo-lucia" }
];
const normalizePhone = (value) => {
  const digits = value.replace(/\\D/g, "");
  if (digits.startsWith("549")) return "+" + digits;
  if (digits.startsWith("54")) return "+" + digits;
  if (digits.length === 10) return "+549" + digits;
  return "+" + digits;
};

export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [tab, setTab] = useState("Inicio");
  const [mode, setMode] = useState("login");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [invite, setInvite] = useState("");
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [posts, setPosts] = useState(demoSeed);
  const [matches, setMatches] = useState([]);
  const [messages, setMessages] = useState([]);
  const [myInterests, setMyInterests] = useState([]);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPost, setShowPost] = useState(false);
  const [offer, setOffer] = useState("");
  const [looking, setLooking] = useState("");
  const [description, setDescription] = useState("");
  const [photo, setPhoto] = useState(null);
  const [people, setPeople] = useState([]);
  const [authorized, setAuthorized] = useState([]);
  const [newPhone, setNewPhone] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [activeMatch, setActiveMatch] = useState(null);
  const [messageText, setMessageText] = useState("");
  const demo = !db;

  useEffect(() => {
    if (!db) {
      const saved = localStorage.getItem("trueke-demo-posts");
      if (saved) setPosts(JSON.parse(saved));
      return;
    }
    db.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = db.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session?.user || !db) { setProfile(null); return; }
    loadProfile(session.user.id);
  }, [session]);

  useEffect(() => {
    if (demo || !profile || profile.status !== "active") return;
    loadPosts();
    if (profile.role === "admin") loadAdmin();
    loadMatches();
  }, [profile]);

  async function loadProfile(id) {
    const { data } = await db.from("profiles").select("*").eq("id", id).maybeSingle();
    setProfile(data);
  }
  async function loadPosts() {
    const { data, error } = await db.from("posts").select("*, profiles(display_name,avatar_url)").eq("active", true).order("created_at", { ascending:false });
    if (!error) setPosts((data || []).map(p => ({...p, display_name:p.profiles?.display_name || "Miembro"})));
  }
  async function loadMatches() {
    const { data } = await db.from("matches").select("*, one:profiles!matches_user_one_fkey(display_name), two:profiles!matches_user_two_fkey(display_name)").order("created_at", {ascending:false});
    setMatches(data || []);
  }
  async function loadAdmin() {
    const [{data: p},{data:a},{data:s}] = await Promise.all([
      db.from("profiles").select("*").order("created_at",{ascending:false}),
      db.from("authorized_phones").select("*").order("created_at",{ascending:false}),
      db.from("app_settings").select("value").eq("key","invite_code").maybeSingle()
    ]);
    setPeople(p || []); setAuthorized(a || []); setInviteCode(s?.value || "");
  }
  async function authenticate(e) {
    e.preventDefault(); setBusy(true); setNotice("");
    try {
      const normalized = normalizePhone(phone);
      if (demo) {
        if (mode === "register") {
          if (!phone.trim() || !invite.trim() || !name.trim()) throw new Error("Completá teléfono, nombre y código de invitación.");
          setProfile({ id:"demo-user", phone:normalized, display_name:name, bio, status:"pending", role:"member" });
          setNotice("Cuenta de demostración creada. En la versión conectada, el administrador debe aprobar el ingreso.");
        } else {
          setProfile({ id:"demo-user", phone:normalized, display_name:"Mi perfil", bio:"", status:"active", role:"member" });
          setNotice("Entraste al modo de demostración.");
        }
      } else if (mode === "register") {
        if (!name.trim()) throw new Error("Ingresá tu nombre.");
        const { data: allowed, error: validationError } = await db.rpc("validate_registration", { p_phone:normalized, p_invite_code:invite.trim() });
        if (validationError) throw validationError;
        if (!allowed) throw new Error("El teléfono no está autorizado o el código es incorrecto. Contactá al administrador.");
        const { error } = await db.auth.signUp({ phone:normalized, password });
        if (error) throw error;
        setNotice("Registro enviado. Tu cuenta queda pendiente de aprobación del administrador. Si no ingresaste automáticamente, iniciá sesión.");
        setMode("login");
      } else {
        const { error } = await db.auth.signInWithPassword({ phone:normalized, password });
        if (error) throw error;
      }
    } catch (err) { setNotice(err.message || "No se pudo completar la operación."); }
    finally { setBusy(false); }
  }
  async function signOut() {
    if (db) await db.auth.signOut();
    setSession(null); setProfile(null); setTab("Inicio"); setNotice("");
  }
  async function createPost(e) {
    e.preventDefault();
    if (!offer.trim() || !looking.trim()) { setNotice("Completá qué ofrecés y qué buscás."); return; }
    if (demo) {
      const item = {id:"local-"+Date.now(),user_id:"demo-user",display_name:"Vos",offer,looking_for:looking,description,image_url:""};
      const next = [item,...posts]; setPosts(next); localStorage.setItem("trueke-demo-posts",JSON.stringify(next));
    } else {
      let image_url = null;
      if (photo) {
        const ext = photo.name.split(".").pop();
        const path = session.user.id+"/"+Date.now()+"."+ext;
        const { error: uploadError } = await db.storage.from("trueke-photos").upload(path,photo,{upsert:false});
        if (uploadError) { setNotice(uploadError.message); return; }
        image_url = db.storage.from("trueke-photos").getPublicUrl(path).data.publicUrl;
      }
      const { error } = await db.from("posts").insert({user_id:session.user.id,offer,looking_for:looking,description,image_url});
      if (error) { setNotice(error.message); return; }
      await loadPosts();
    }
    setOffer(""); setLooking(""); setDescription(""); setPhoto(null); setShowPost(false); setNotice("¡Publicación cargada!");
  }
  async function interest(post) {
    if (demo) {
      setMyInterests(prev => prev.includes(post.id) ? prev : [...prev,post.id]);
      setNotice("¡Interés registrado! En la versión conectada se avisará a la otra persona.");
      return;
    }
    const { error } = await db.from("interests").insert({post_id:post.id,from_user:session.user.id});
    if (error && !error.message.includes("duplicate")) setNotice(error.message);
    else { setMyInterests(prev => [...prev,post.id]); setNotice("Le avisamos a la otra persona."); await loadMatches(); }
  }
  async function saveProfile(e) {
    e.preventDefault();
    if (demo) { setProfile({...profile,display_name:name || profile.display_name,bio}); setNotice("Perfil actualizado en esta demostración."); return; }
    const {error} = await db.from("profiles").update({display_name:name,bio}).eq("id",session.user.id);
    if (error) setNotice(error.message); else { await loadProfile(session.user.id); setNotice("Perfil actualizado."); }
  }
  async function addAuthorized(e) {
    e.preventDefault(); const p=normalizePhone(newPhone);
    if (demo) { setAuthorized([...authorized,{phone:p,note:"Agregado en demo"}]); setNewPhone(""); return; }
    const {error}=await db.from("authorized_phones").insert({phone:p});
    if (error) setNotice(error.message); else {setNewPhone("");loadAdmin();setNotice("Teléfono autorizado.");}
  }
  async function setMemberStatus(id,status) {
    if (demo) { setPeople(people.map(p=>p.id===id?{...p,status}:p)); return; }
    const {error}=await db.from("profiles").update({status}).eq("id",id);
    if (error) setNotice(error.message); else loadAdmin();
  }
  async function saveInvite(e) {
    e.preventDefault();
    if (demo) {setNotice("En la versión conectada, el código se guarda de forma privada en Supabase.");return;}
    const {error}=await db.from("app_settings").upsert({key:"invite_code",value:inviteCode},{onConflict:"key"});
    setNotice(error ? error.message : "Código general actualizado.");
  }
  async function sendMessage(e) {
    e.preventDefault(); if(!messageText.trim() || !activeMatch) return;
    if (demo) {setMessages([...messages,{id:Date.now(),body:messageText,sender_id:"demo-user"}]);setMessageText("");return;}
    const {error}=await db.from("messages").insert({match_id:activeMatch.id,sender_id:session.user.id,body:messageText});
    if(error) setNotice(error.message); else setMessageText("");
  }

  const myPosts = useMemo(()=>posts.filter(p=>p.user_id==="demo-user" || (session && p.user_id===session.user.id)),[posts,session]);
  const status = profile?.status;
  const initials = (profile?.display_name || "TP").slice(0,1).toUpperCase();

  if (!profile && !session) return <main className="auth-shell"><div className="auth-card"><div className="brand-mark">T</div><p className="eyebrow">COMUNIDAD PRIVADA · RÍO GRANDE</p><h1>Trueke <span>PRG</span></h1><p className="muted">Lo que ya no necesitás puede ser justo lo que alguien está buscando.</p>{demo && <div className="demo-note">Vista de demostración: los datos se guardan solo en este navegador.</div>}<div className="switcher"><button className={mode==="login"?"selected":""} onClick={()=>setMode("login")}>Ingresar</button><button className={mode==="register"?"selected":""} onClick={()=>setMode("register")}>Crear cuenta</button></div><form onSubmit={authenticate} className="stack"><label>Teléfono celular<input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="2964 123456" required /></label>{mode==="register" && <><label>Nombre<input value={name} onChange={e=>setName(e.target.value)} placeholder="Cómo te conocen en el grupo" required /></label><label>Código general del grupo<input value={invite} onChange={e=>setInvite(e.target.value)} placeholder="Código compartido en WhatsApp" required /></label></>}<label>Contraseña<input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Mínimo 8 caracteres" minLength="8" required /></label><button className="primary wide" disabled={busy}>{busy?"Un momento…":mode==="register"?"Solicitar ingreso":"Entrar a Trueke"}</button></form>{notice && <p className="notice">{notice}</p>}<p className="tiny">El teléfono debe estar en la lista de miembros autorizados. Las cuentas nuevas requieren aprobación.</p></div></main>;

  if (status === "pending" || status === "blocked") return <main className="auth-shell"><div className="auth-card center"><div className="brand-mark">T</div><h1>{status==="pending"?"Estamos revisando tu ingreso":"Cuenta suspendida"}</h1><p className="muted">{status==="pending"?"Tu teléfono está registrado, pero el administrador debe aprobar tu cuenta antes de que puedas ver la comunidad.":"Tu cuenta no tiene acceso en este momento. Contactá al administrador."}</p><button className="secondary wide" onClick={signOut}>Cerrar sesión</button></div></main>;

  return <div className="app-shell"><aside className="sidebar"><div className="brand"><div className="brand-mark small">T</div><div><strong>Trueke PRG</strong><small>Comunidad privada</small></div></div><nav>{["Inicio","Matches","Mensajes","Mis publicaciones","Perfil",...(profile?.role==="admin"?["Administración"]:[])].map(t=><button key={t} className={tab===t?"nav-active":""} onClick={()=>setTab(t)}><span>{({Inicio:"⌂",Matches:"♡",Mensajes:"☷","Mis publicaciones":"▤",Perfil:"◉",Administración:"⚙"})[t]}</span>{t}</button>)}</nav><div className="sidebar-bottom"><div className="user-mini"><div className="avatar">{initials}</div><div><b>{profile?.display_name || "Mi cuenta"}</b><small>Río Grande</small></div></div><button className="logout" onClick={signOut}>Cerrar sesión</button></div></aside>
  <main className="main"><header className="topbar"><div><p className="eyebrow">RÍO GRANDE · TIERRA DEL FUEGO</p><h2>{tab==="Inicio"?"Encontrá tu próximo trueque":tab}</h2></div><button className="primary" onClick={()=>setShowPost(true)}>＋ Publicar</button></header>
  {notice && <div className="notice-bar"><span>{notice}</span><button onClick={()=>setNotice("")}>×</button></div>}
  {tab==="Inicio" && <><section className="welcome"><div><span className="pill">SIN DINERO · SOLO INTERCAMBIOS</span><h3>Un buen trueque<br/>empieza con una idea.</h3><p>Compartí lo que ofrecés y contá qué te gustaría recibir.</p></div><div className="welcome-art">⇄</div></section><div className="section-head"><div><h3>Publicaciones de la comunidad</h3><p>Descubrí qué están intercambiando los miembros.</p></div><span className="count">{posts.length} publicaciones</span></div><div className="post-grid">{posts.map(post=><article className="post-card" key={post.id}>{post.image_url?<img className="post-image" src={post.image_url} alt="Foto de publicación"/>:<div className="post-placeholder"><span>⇄</span></div>}<div className="post-content"><div className="post-author"><div className="avatar">{(post.display_name||"M").slice(0,1)}</div><b>{post.display_name || "Miembro"}</b><span>Río Grande</span></div><div className="trade-line"><small>OFRECE</small><p>{post.offer}</p></div><div className="trade-line looking"><small>BUSCA</small><p>{post.looking_for}</p></div>{post.description && <p className="post-description">{post.description}</p>}<button className={myInterests.includes(post.id)?"secondary wide":"outline wide"} disabled={myInterests.includes(post.id) || post.user_id==="demo-user" || (session && post.user_id===session.user.id)} onClick={()=>interest(post)}>{myInterests.includes(post.id)?"✓ Te interesa":"♡ Me interesa"}</button></div></article>)}</div></>}
  {tab==="Matches" && <section className="empty-panel"><div className="empty-icon">♡</div><h3>Tus coincidencias</h3><p>Cuando dos personas se interesen mutuamente, el match aparecerá acá y podrán conversar.</p>{matches.length>0?matches.map(m=><div className="match-row" key={m.id}><b>{m.one?.display_name} ↔ {m.two?.display_name}</b><button className="outline" onClick={()=>{setActiveMatch(m);setTab("Mensajes")}}>Abrir conversación</button></div>):<span className="muted">Todavía no tenés matches.</span>}</section>}
  {tab==="Mensajes" && <section className="empty-panel"><div className="empty-icon">☷</div><h3>Mensajes privados</h3><p>El chat se habilita cuando ambas personas aceptan el intercambio.</p>{activeMatch?<div className="chat-box"><div className="chat-messages">{messages.map(m=><p className="chat-bubble" key={m.id}>{m.body}</p>)}</div><form onSubmit={sendMessage} className="chat-send"><input value={messageText} onChange={e=>setMessageText(e.target.value)} placeholder="Escribí un mensaje…"/><button className="primary">Enviar</button></form></div>:<span className="muted">Elegí un match para abrir la conversación.</span>}</section>}
  {tab==="Mis publicaciones" && <><div className="section-head"><div><h3>Lo que publicaste</h3><p>Administrá tus propuestas de intercambio.</p></div><button className="outline" onClick={()=>setShowPost(true)}>＋ Nueva publicación</button></div><div className="post-grid">{myPosts.map(p=><article className="post-card" key={p.id}><div className="post-placeholder"><span>⇄</span></div><div className="post-content"><div className="trade-line"><small>OFRECÉS</small><p>{p.offer}</p></div><div className="trade-line looking"><small>BUSCÁS</small><p>{p.looking_for}</p></div></div></article>)}{!myPosts.length&&<p className="muted">Todavía no publicaste nada.</p>}</div></>}
  {tab==="Perfil" && <section className="form-panel"><h3>Tu perfil</h3><p className="muted">Mostrá quién sos dentro de la comunidad.</p><form className="stack" onSubmit={saveProfile}><label>Nombre<input value={name || profile?.display_name || ""} onChange={e=>setName(e.target.value)} placeholder="Tu nombre"/></label><label>Descripción breve<textarea value={bio || profile?.bio || ""} onChange={e=>setBio(e.target.value)} placeholder="Contá algo sobre vos…" rows="4"/></label><label>Teléfono registrado<input value={profile?.phone || ""} disabled/></label><button className="primary">Guardar perfil</button></form></section>}
  {tab==="Administración" && profile?.role==="admin" && <div className="admin-layout"><section className="form-panel"><h3>Accesos autorizados</h3><p className="muted">Solo los teléfonos cargados acá pueden solicitar ingreso.</p><form className="inline-form" onSubmit={addAuthorized}><input value={newPhone} onChange={e=>setNewPhone(e.target.value)} placeholder="Número, ej. 2964 123456" required/><button className="primary">Agregar</button></form>{authorized.map(a=><div className="admin-row" key={a.phone}><span>{a.phone}</span><small>{a.note||"Autorizado"}</small><button className="text-button" onClick={async()=>{if(!demo){await db.from("authorized_phones").delete().eq("phone",a.phone);loadAdmin()}else setAuthorized(authorized.filter(x=>x.phone!==a.phone))}}>Quitar</button></div>)}</section><section className="form-panel"><h3>Código general</h3><p className="muted">Compartilo una sola vez en el grupo. Cambialo cuando quieras.</p><form className="stack" onSubmit={saveInvite}><input value={typeof inviteCode==="string"?inviteCode:JSON.stringify(inviteCode).replaceAll('"',"")} onChange={e=>setInviteCode(e.target.value)} placeholder="Nuevo código general"/><button className="primary">Guardar código</button></form></section><section className="form-panel full"><h3>Solicitudes y miembros</h3>{people.map(p=><div className="admin-row" key={p.id}><div><b>{p.display_name || "Sin nombre"}</b><small>{p.phone}</small></div><span className={"status "+p.status}>{p.status}</span>{p.status==="pending"&&<button className="primary compact" onClick={()=>setMemberStatus(p.id,"active")}>Aprobar</button>}{p.status!=="blocked"?<button className="text-button" onClick={()=>setMemberStatus(p.id,"blocked")}>Bloquear</button>:<button className="text-button" onClick={()=>setMemberStatus(p.id,"active")}>Reactivar</button>}</div>)}</section></div>}
  <footer>Trueke PRG <span>·</span> Una comunidad para compartir, reutilizar e intercambiar.</footer>
  </main>
  {showPost && <div className="modal-backdrop" onClick={()=>setShowPost(false)}><div className="modal" onClick={e=>e.stopPropagation()}><button className="modal-close" onClick={()=>setShowPost(false)}>×</button><p className="eyebrow">NUEVA PUBLICACIÓN</p><h2>¿Qué tenés para intercambiar?</h2><form className="stack" onSubmit={createPost}><label>Qué ofrecés<input value={offer} onChange={e=>setOffer(e.target.value)} placeholder="Ej. Una guitarra criolla en buen estado" required/></label><label>Qué buscás<input value={looking} onChange={e=>setLooking(e.target.value)} placeholder="Ej. Una bicicleta para adulto" required/></label><label>Contanos un poco más<textarea value={description} onChange={e=>setDescription(e.target.value)} placeholder="Estado, detalles, zona de entrega…" rows="3"/></label><label>Foto (opcional)<input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>setPhoto(e.target.files?.[0] || null)}/></label><button className="primary wide">Publicar trueque</button></form></div></div>}
  </div>;
}
