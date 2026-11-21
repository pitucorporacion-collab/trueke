import React, { useEffect, useMemo, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  ArrowRight, ArrowUpRight, Bell, Check, Heart, ImagePlus, Smartphone, LogOut, Menu, XCircle,
  MapPin, Plus, Search, ShieldCheck, Tag, X, MessageCircle, Flag,
  Users, Ban, CheckCircle2, Send, Handshake, AlertTriangle
} from 'lucide-react';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;
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
  const [authorizedPhones,setAuthorizedPhones] = useState([]);
  const [accessRequests,setAccessRequests] = useState([]);
  const [accessRequestOpen,setAccessRequestOpen] = useState(false);
  const [requestName,setRequestName] = useState('');
  const [requestPhone,setRequestPhone] = useState('');
  const [requestSending,setRequestSending] = useState(false);
  const [requestFeedback,setRequestFeedback] = useState('');
  const [accessBusy,setAccessBusy] = useState(false);
  const [accessWhatsApp,setAccessWhatsApp] = useState(null);
  const [newMemberPhone,setNewMemberPhone] = useState('');
  const [newMemberName,setNewMemberName] = useState('');
  const [newMemberPassword,setNewMemberPassword] = useState('');
  const [creatingMember,setCreatingMember] = useState(false);
  const [passwordModal,setPasswordModal] = useState(false);
  const [passwordTarget,setPasswordTarget] = useState(null);
  const [temporaryPassword,setTemporaryPassword] = useState('');
  const [newOwnPassword,setNewOwnPassword] = useState('');
  const [passwordBusy,setPasswordBusy] = useState(false);
  const [loading,setLoading] = useState(true);
  const [installPrompt,setInstallPrompt] = useState(null);
  const [installHelp,setInstallHelp] = useState(false);
  const [requestUserHelp,setRequestUserHelp] = useState(false);
  const [appInstalled,setAppInstalled] = useState(false);
  const [authError,setAuthError] = useState('');
  const [authBusy,setAuthBusy] = useState(false);
  const [phone,setPhone] = useState('');
  const [password,setPassword] = useState('');
  const [query,setQuery] = useState('');
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
  const [cycleSeen,setCycleSeen] = useState([]);
  const [swipeDecisions,setSwipeDecisions] = useState({});
  const [swipeStart,setSwipeStart] = useState(null);
  const [swipeBusy,setSwipeBusy] = useState(false);
  const categories = ['Tecnología','Muebles','Moda','Súper','Herramientas','Música','Juguetes y varios'];
  const [formCategory,setFormCategory] = useState('Juguetes y varios');

  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    setAppInstalled(standalone);
    const handlePrompt = event => {
      event.preventDefault();
      setInstallPrompt(event);
    };
    const handleInstalled = () => {
      setAppInstalled(true);
      setInstallPrompt(null);
      setInstallHelp(false);
    };
    window.addEventListener('beforeinstallprompt', handlePrompt);
    window.addEventListener('appinstalled', handleInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', handlePrompt);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  async function installApp() {
    if (appInstalled) return;
    if (installPrompt) {
      installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice?.outcome === 'accepted') setInstallHelp(false);
      setInstallPrompt(null);
      return;
    }
    setInstallHelp(value => !value);
  }

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
      supabase.from('listings').select('*, profiles(display_name), listing_images(id,storage_path,sort_order)').or('status.eq.published,user_id.eq.'+session.user.id).order('created_at',{ascending:false})
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
    const {data:swipeRows} = await supabase.from('listing_swipes').select('listing_id,decision').eq('user_id',session.user.id);
    setSwipeDecisions(Object.fromEntries((swipeRows || []).map(row=>[row.listing_id,row.decision])));
    setContacts(contactRows || []);
    setProposals(proposalRows || []);
    if (me?.role === 'admin') {
      const [{data:reportRows},{data:notificationRows},{data:memberRows},{data:requestRows}] = await Promise.all([
        supabase.from('reports').select('*, reporter:profiles!reports_reporter_id_fkey(display_name,phone), listing:listings!reports_listing_id_fkey(title)').order('created_at',{ascending:false}),
        supabase.from('admin_notifications').select('*').order('created_at',{ascending:false}).limit(30),
        supabase.rpc('admin_get_members'),
        supabase.from('access_requests').select('*').order('created_at',{ascending:false})
      ]);
      setReports(reportRows || []);
      setNotifications(notificationRows || []);
      setMembers(memberRows || []);
      setAccessRequests(requestRows || []);
      const {data:accessData,error:accessError} = await supabase.functions.invoke('admin-user-management',{body:{action:'list'}});
      if (accessError) setNotice('No pudimos cargar los teléfonos autorizados: '+accessError.message);
      else setAuthorizedPhones(accessData?.phones || []);
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
      const {error} = await supabase.auth.signInWithPassword({email:emailForAuth,password});
      if (error) throw error;
    } catch(err) { setAuthError(err.message || 'Ocurrió un error. Intentá nuevamente.'); }
    finally { setAuthBusy(false); }
  }

  const eligibleListings = useMemo(() => listings.filter(item => {
    const text = [item.title,item.description,item.looking_for,item.profiles?.display_name].join(' ').toLowerCase();
    return item.user_id !== session?.user?.id && text.includes(query.toLowerCase()) && (item.listing_images || []).length > 0;
  }),[listings,query,session]);
  const filtered = eligibleListings.filter(item => !cycleSeen.includes(item.id));
  const currentListing = filtered[0] || eligibleListings[0];
  async function swipeListing(direction) {
    if (!currentListing || swipeBusy) return;
    setSwipeBusy(true);
    const decision = direction === 'right' ? 'like' : 'dislike';
    const {error} = await supabase.rpc('record_listing_swipe',{p_listing_id:currentListing.id,p_decision:decision});
    setSwipeBusy(false);
    if (error) { setNotice(error.message || 'No se pudo guardar tu decisión.'); return; }
    setSwipeDecisions(prev=>({...prev,[currentListing.id]:decision}));
    const nextSeen = [...cycleSeen,currentListing.id];
    if (nextSeen.length >= eligibleListings.length) {
      setCycleSeen([]);
      setNotice(direction === 'right' ? '¡Me gusta registrado! Ya recorriste todos los artículos; volvemos a empezar.' : 'Artículo descartado. Ya recorriste todos; volvemos a empezar.');
    } else {
      setCycleSeen(nextSeen);
      setNotice(direction === 'right' ? '¡Me gusta registrado!' : 'Artículo descartado.');
    }
    await loadData();
  }
  function finishSwipe(e) {
    if (swipeStart === null) return;
    const delta = e.changedTouches[0].clientX - swipeStart;
    if (Math.abs(delta) > 65) swipeListing(delta > 0 ? 'right' : 'left');
    setSwipeStart(null);
  }

  function selectImages(files) { setImages(Array.from(files || []).slice(0,1)); }

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
    const ownListingCount = listings.filter(item=>item.user_id===session.user.id).length;
    if (ownListingCount >= 4) { setNotice('Ya alcanzaste el máximo de 4 publicaciones. Borrá una para publicar otra.'); return; }
    if (!form.title.trim() || !form.looking_for.trim()) return;
    if (form.title.trim().length > 30 || form.looking_for.trim().length > 30 || form.description.trim().length > 60) {
      setNotice('Revisá los límites: Tiene y Busca hasta 30 caracteres; descripción hasta 60.'); return;
    }
    if (images.length !== 1) { setNotice('Cada publicación requiere exactamente una foto.'); return; }
    setSaving(true); setNotice('');
    try {
      const {data:listing,error} = await supabase.from('listings').insert({
        user_id:session.user.id,title:form.title.trim(),description:form.description.trim(),
        looking_for:form.looking_for.trim(),category:formCategory,location:'Río Grande',status:'published'
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
      setShowCreate(false); setForm({title:'',description:'',looking_for:'',location:'Río Grande'}); setFormCategory('Juguetes y varios'); setImages([]);
      setNotice('¡Publicación cargada! Ya está visible para todos los miembros.');
      await loadData();
    } catch(err) { setNotice(err.message || 'No se pudo publicar.'); }
    finally { setSaving(false); }
  }

  async function addInterest(item) {
    if (item.user_id === session.user.id) return;
    const {error} = await supabase.rpc('record_listing_swipe',{p_listing_id:item.id,p_decision:'like'});
    if (error) setNotice(error.message);
    else setNotice('¡Me gusta registrado! Si la otra persona también eligió tu publicación, tendrán un match.');
    await loadData();
  }

  async function deleteListing(item) {
    if (!window.confirm('¿Querés borrar la publicación «'+item.title+'»? Esta acción no se puede deshacer.')) return;
    const paths = (item.listing_images || []).map(photo=>photo.storage_path).filter(Boolean);
    if (paths.length) await supabase.storage.from('listing-photos').remove(paths);
    const {error} = await supabase.from('listings').delete().eq('id',item.id).eq('user_id',session.user.id);
    if (error) setNotice(error.message || 'No se pudo borrar la publicación.');
    else { setNotice('Publicación eliminada.'); await loadData(); }
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
      reported_user:reportTarget.userId || null,listing_title:reportTarget.title || '',reason:reportReason,details:reportDetails.trim()
    });
    if (error?.code === '23505') setNotice('Ya denunciaste esta publicación. Solo se permite una denuncia por usuario y publicación.');
    else if (error) setNotice(error.message);
    else { setNotice('Denuncia enviada. Gracias por ayudar a cuidar la comunidad.'); setReportTarget(null); setReportDetails(''); await loadData(); }
  }

  async function submitAccessRequest(e) {
    e.preventDefault(); setRequestFeedback('');
    const cleanPhone = requestPhone.replace(/\D/g,'');
    if (!/^2964\d{6}$/.test(cleanPhone)) { setRequestFeedback('Ingresá un teléfono válido: 2964 y otros 6 números.'); return; }
    if (requestName.trim().length < 2) { setRequestFeedback('Ingresá tu nombre.'); return; }
    setRequestSending(true);
    const {error} = await supabase.from('access_requests').insert({display_name:requestName.trim(),phone:cleanPhone});
    if (error?.code === '23505') setRequestFeedback('Ya existe una solicitud pendiente para ese número.');
    else if (error) setRequestFeedback('No pudimos enviar la solicitud. Intentá nuevamente.');
    else { setRequestFeedback('¡Solicitud enviada! El administrador la revisará y te contactará por WhatsApp.'); setRequestName(''); setRequestPhone(''); }
    setRequestSending(false);
  }

  function makeTemporaryPassword() {
    const bytes = crypto.getRandomValues(new Uint8Array(12));
    return 'Tk!' + Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('') + 'A9';
  }

  async function approveAccessRequest(request) {
    if (accessBusy) return;
    setAccessBusy(true); setNotice('');
    const tempPassword = makeTemporaryPassword();
    try {
      const {error:allowError} = await supabase.functions.invoke('admin-user-management',{body:{action:'authorize',phone:request.phone}});
      if (allowError) throw allowError;
      const {data,error} = await supabase.functions.invoke('admin-user-management',{body:{
        action:'create_user',phone:request.phone,display_name:request.display_name,password:tempPassword
      }});
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const {error:updateError} = await supabase.from('access_requests').update({status:'approved',reviewed_at:new Date().toISOString(),reviewed_by:session.user.id}).eq('id',request.id).eq('status','pending');
      if (updateError) throw updateError;
      const message = '¡Hola '+request.display_name+'! Tu solicitud para ingresar a Trueke PRG fue aprobada.\n\nIngresá desde: https://trueke-prg.vercel.app\nUsuario: '+request.phone+'\nContraseña provisoria: '+tempPassword+'\n\nPodés cambiarla cuando quieras desde Mi cuenta. ¡Bienvenido/a!';
      setAccessWhatsApp({phone:request.phone,password:tempPassword,url:'https://wa.me/549'+request.phone+'?text='+encodeURIComponent(message)});
      setNotice('Solicitud aprobada. Abrí WhatsApp para enviarle el acceso.');
      await loadData();
    } catch(err) { setNotice(err.message || 'No se pudo autorizar la solicitud.'); }
    finally { setAccessBusy(false); }
  }

  async function rejectAccessRequest(request) {
    if (!window.confirm('¿Rechazar la solicitud de '+request.display_name+'?')) return;
    const {error} = await supabase.from('access_requests').update({status:'rejected',reviewed_at:new Date().toISOString(),reviewed_by:session.user.id}).eq('id',request.id).eq('status','pending');
    if (error) setNotice(error.message); else { setNotice('Solicitud rechazada.'); await loadData(); }
  }

  async function deleteReportedListing(report) {
    if (!report.listing_id) { setNotice('La publicación ya no está disponible.'); return; }
    if (!window.confirm('¿Eliminar la publicación denunciada? Esta acción no se puede deshacer.')) return;
    const {data:imagesForRemoval} = await supabase.from('listing_images').select('storage_path').eq('listing_id',report.listing_id);
    const paths = (imagesForRemoval || []).map(x=>x.storage_path).filter(Boolean);
    if (paths.length) await supabase.storage.from('listing-photos').remove(paths);
    const {error} = await supabase.from('listings').delete().eq('id',report.listing_id);
    if (error) setNotice(error.message); else { await supabase.from('reports').update({status:'closed'}).eq('id',report.id); setNotice('Publicación eliminada.'); await loadData(); }
  }


  async function createManagedMember(e) {
    e.preventDefault();
    setNotice('');
    const cleanPhone = newMemberPhone.replace(/\D/g,'');
    if (!/^2964\d{6}$/.test(cleanPhone)) { setNotice('El teléfono debe tener 10 números: 2964 y otros 6 números.'); return; }
    if (newMemberName.trim().length < 2) { setNotice('Ingresá el nombre del usuario.'); return; }
    if (newMemberPassword.length < 8) { setNotice('La contraseña debe tener al menos 8 caracteres.'); return; }
    setCreatingMember(true);
    try {
      const {error:allowError} = await supabase.functions.invoke('admin-user-management',{body:{action:'authorize',phone:cleanPhone}});
      if (allowError) throw allowError;
      const {data,error} = await supabase.functions.invoke('admin-user-management',{body:{
        action:'create_user',phone:cleanPhone,display_name:newMemberName.trim(),password:newMemberPassword
      }});
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setNewMemberPhone(''); setNewMemberName(''); setNewMemberPassword('');
      setNotice('Cuenta creada. El usuario ya puede ingresar con su teléfono y contraseña.');
      await loadData();
    } catch(err) {
      setNotice(err.message || 'No se pudo crear la cuenta.');
    } finally { setCreatingMember(false); }
  }

  async function removeAuthorizedPhone(item) {
    const digits = String(item.phone || '').replace(/\D/g,'').replace(/^549/,'');
    if (!/^2964\d{6}$/.test(digits)) { setNotice('El teléfono guardado tiene un formato inválido.'); return; }
    if (!window.confirm('¿Eliminar el teléfono '+item.phone+' de la lista de autorizados? Si ya tenía una cuenta, también quedará bloqueada.')) return;
    const {data,error} = await supabase.functions.invoke('admin-user-management',{body:{action:'remove',phone:digits}});
    if (error || data?.error) { setNotice(data?.error || error?.message || 'No se pudo eliminar el teléfono.'); return; }
    setNotice('Teléfono eliminado de la lista de autorizados.');
    await loadData();
  }

  async function setMemberActive(member,active) {
    const action = active ? 'habilitar' : 'bloquear';
    if (!window.confirm('¿Querés '+action+' a '+member.display_name+'?')) return;
    const {error} = await supabase.rpc('admin_set_member_active',{p_user_id:member.id,p_active:active});
    if (error) setNotice(error.message);
    else { setNotice(active?'Miembro habilitado.':'Miembro bloqueado y sus publicaciones pausadas.'); await loadData(); }
  }

  async function resetMemberPassword(member) {
    if (!window.confirm('¿Generar una contraseña temporal nueva para '+(member.display_name || member.phone)+'? La contraseña anterior dejará de funcionar.')) return;
    setPasswordBusy(true); setPasswordTarget(member); setTemporaryPassword(''); setPasswordModal(true); setNotice('');
    const {data,error} = await supabase.functions.invoke('admin-reset-password',{body:{user_id:member.id}});
    if (error || data?.error) {
      setNotice(data?.error || error?.message || 'No se pudo restablecer la contraseña.');
      setPasswordModal(false); setPasswordTarget(null);
    } else {
      setTemporaryPassword(data.temporary_password || '');
    }
    setPasswordBusy(false);
  }

  async function changeOwnPassword(e) {
    e.preventDefault();
    if (newOwnPassword.length < 8) { setNotice('La contraseña debe tener al menos 8 caracteres.'); return; }
    setPasswordBusy(true);
    const {error} = await supabase.auth.updateUser({password:newOwnPassword});
    setPasswordBusy(false);
    if (error) setNotice(error.message);
    else { setNotice('Tu contraseña fue actualizada correctamente.'); setPasswordModal(false); setNewOwnPassword(''); }
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

  if (!supabase) return <div className="setup"><div className="brand-mark"><Handshake size={22}/></div><h1>Falta conectar Trueke PRG</h1><p>Configurá VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY para iniciar.</p></div>;

  if (session && profile && profile.is_active === false) return <main className="setup"><div className="brand-mark"><ShieldCheck size={22}/></div><h1>Acceso suspendido</h1><p>Tu cuenta está bloqueada por administración. Si creés que es un error, contactá al administrador de Trueke PRG.</p><button className="primary-btn" onClick={logout}>Cerrar sesión</button></main>;

  if (!session) return <main className="auth-shell">
    <section className="auth-art">
      <div className="auth-brand"><div className="brand-mark"><Handshake size={23}/></div><span>Trueke <b>Para Rio Grande</b></span></div>
      <div className="art-copy"><span className="eyebrow light">UNA COMUNIDAD QUE COMPARTE</span><h1>Lo que tenés,<br/><em>vale por lo que</em><br/>necesitás.</h1><p>Un lugar para intercambiar cosas, saberes y servicios entre nosotros. Sin plata. Sin vueltas.</p></div>
      <div className="art-footer"><span>Intercambios con sentido.</span><span>01 — Comunidad PRG</span></div>
      <div className="art-orbit orbit-one"></div><div className="art-orbit orbit-two"></div>
    </section>
    <section className="auth-panel">
      <div className="mobile-brand"><div className="brand-mark"><Handshake size={22}/></div><span>Trueke <b>Para Rio Grande</b></span></div>
      <div className="auth-card">
        <span className="eyebrow">QUÉ BUENO VERTE</span>
        <h2>Entrá a tu comunidad</h2>
        <p className="muted">Ingresá con tu teléfono y contraseña.</p>
        <form onSubmit={handleAuth}>
          <label>Teléfono (tu usuario)<input type="tel" inputMode="numeric" value={phone} onChange={e=>setPhone(e.target.value.replace(/\D/g,'').slice(0,10))} placeholder="2964XXXXXX" autoComplete="tel" maxLength={10} minLength={10} pattern="2964[0-9]{6}" required/><small>Usá 2964 seguido de 6 números.</small></label>
          <label>Contraseña<input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Mínimo 8 caracteres" autoComplete="current-password" minLength={8} required/></label>
          {authError && <div className="error-box">{authError}</div>}
          <button className="primary-btn full" disabled={authBusy}>{authBusy?'Un momento…':'Ingresar a Trueke'} <ArrowRight size={17}/></button>
        </form>
        <div className="privacy-note"><ShieldCheck size={16}/> Acceso privado para miembros autorizados.</div>
        {!appInstalled && <button type="button" className="install-app-btn" onClick={installApp}><Smartphone size={18}/> App móvil</button>}
        {installHelp && <div className="install-help" role="status"><b>Instalá Trueke en tu celular</b><span>Android: abrí el menú ⋮ de Chrome y elegí “Instalar aplicación” o “Agregar a pantalla principal”.</span><span>iPhone: tocá Compartir en Safari y elegí “Agregar a pantalla de inicio”.</span></div>}
        <div className="request-user"><span>¿Todavía no tenés usuario?</span><button type="button" onClick={()=>{setAccessRequestOpen(value=>!value);setRequestFeedback('')}} className="request-user-btn">Solicitar mi usuario</button></div>
        {accessRequestOpen&&<form className="request-access-form" onSubmit={submitAccessRequest}><label>Nombre<input value={requestName} onChange={e=>setRequestName(e.target.value)} placeholder="Tu nombre" minLength={2} maxLength={60} required/></label><label>Teléfono<input type="tel" inputMode="numeric" value={requestPhone} onChange={e=>setRequestPhone(e.target.value.replace(/\D/g,'').slice(0,10))} placeholder="2964XXXXXX" maxLength={10} pattern="2964[0-9]{6}" required/></label><button className="primary-btn full" disabled={requestSending}>{requestSending?'Enviando…':'Enviar solicitud'}</button>{requestFeedback&&<small className="request-feedback">{requestFeedback}</small>}</form>}
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
      <a className="brand" href="#" onClick={()=>setPage('explore')}><div className="brand-mark"><Handshake size={21}/></div><span>Trueke <b>Para Rio Grande</b></span></a>
      <button className="app-menu-button" onClick={()=>setPage('menu')}><Menu size={19}/> Menú</button>
      <div className="top-actions"><button className="icon-btn" aria-label="Notificaciones" onClick={()=>profile?.role==='admin'?setPage('admin'):setPage('matches')}><Bell size={19}/>{unreadCount>0&&<i className="notification-dot"/>}</button><div className="user-chip"><div className="avatar">{(profile?.display_name||'U').slice(0,1).toUpperCase()}</div><span>{profile?.display_name||'Mi cuenta'}</span>{profile?.role==='admin'&&<span className="admin-pill">ADMIN</span>}</div></div>
    </header>
    <main>
      {page==='menu'&&<section className="menu-page">
        <div className="menu-page-head"><span className="eyebrow">TU ESPACIO EN TRUEKE PRG</span><h1>¿Qué hacemos hoy?</h1><p>Todo lo que necesitás, en un solo lugar.</p></div>
        <div className="menu-page-grid">
          <button className="menu-tile menu-tile-primary" onClick={()=>setPage('explore')}><span className="menu-tile-icon"><Heart size={25}/></span><b>Descubrir Truekes</b><small>Ver productos y encontrar algo que te interese</small><ArrowRight size={19}/></button>
          <button className="menu-tile" onClick={()=>setPage('my-listings')}><span className="menu-tile-icon"><Tag size={24}/></span><b>Mis publicaciones</b><small>Ver, administrar o borrar tus artículos</small><ArrowRight size={19}/></button>
          <button className="menu-tile" onClick={()=>setPage('matches')}><span className="menu-tile-icon"><Handshake size={24}/></span><b>Intercambio</b><small>Ver tus matches y coordinar por WhatsApp</small><ArrowRight size={19}/></button>
          <button className="menu-tile" onClick={()=>setPage('account')}><span className="menu-tile-icon"><ShieldCheck size={24}/></span><b>Mi cuenta y contraseña</b><small>Administrar la seguridad de tu cuenta</small><ArrowRight size={19}/></button>
          {profile?.role==='admin'&&<button className="menu-tile" onClick={()=>setPage('admin')}><span className="menu-tile-icon"><Users size={24}/></span><b>Administración</b><small>Gestionar miembros y reportes</small><ArrowRight size={19}/></button>}
          <button className="menu-tile menu-tile-logout" onClick={logout}><span className="menu-tile-icon"><LogOut size={23}/></span><b>Cerrar sesión</b><small>Salir de tu cuenta de Trueke PRG</small><ArrowRight size={19}/></button>
        </div>
        <button className="menu-back" onClick={()=>setPage('explore')}>Volver a descubrir productos</button>
      </section>}
      {page==='my-listings'&&<section className="dashboard-section">
        <span className="eyebrow">LO QUE COMPARTÍS</span><h1>Mis publicaciones</h1><p className="muted">Tenés {listings.filter(item=>item.user_id===session.user.id).length} de 4 publicaciones. Podés agregar otra hasta llegar al máximo.</p>
        {listings.filter(item=>item.user_id===session.user.id).length<4
          ? <button className="primary-btn" onClick={()=>setShowCreate(true)}><Plus size={17}/> Publicar otra ({listings.filter(item=>item.user_id===session.user.id).length}/4)</button>
          : <p className="muted">Llegaste al máximo de 4 publicaciones. Si querés agregar otra, primero borrá una.</p>}
        <div className="my-listings-grid">{listings.filter(item=>item.user_id===session.user.id).map(item=><article className="my-listing-card" key={item.id}>{photos[item.id]&&<img src={photos[item.id]} alt={item.title}/>}<div><span className="eyebrow">{item.category||'Trueque'}</span><h3>{item.title}</h3><p>Busco: {item.looking_for}</p><button className="delete-listing-btn" onClick={()=>deleteListing(item)}><XCircle size={16}/> Borrar publicación</button></div></article>)}</div>
        {listings.filter(item=>item.user_id===session.user.id).length===0&&<div className="empty-state"><Tag size={34}/><h3>Todavía no publicaste nada</h3><p>Subí tu primer artículo para empezar a intercambiar.</p></div>}
        <button className="menu-back" onClick={()=>setPage('menu')}>Volver al menú</button>
      </section>}
      {page==='account'&&<section className="dashboard-section account-page">
        <span className="eyebrow">TU PERFIL</span><h1>Mi cuenta</h1><p className="muted">Tus datos de acceso y seguridad.</p>
        <div className="account-summary"><div className="avatar account-avatar">{(profile?.display_name||'U').slice(0,1).toUpperCase()}</div><div><b>{profile?.display_name||'Mi cuenta'}</b><span>{session.user.email}</span></div></div>
        <button className="primary-btn" onClick={()=>{setPasswordTarget(null);setTemporaryPassword('');setNewOwnPassword('');setPasswordModal(true)}}><ShieldCheck size={17}/> Cambiar contraseña</button>
        <button className="menu-back" onClick={()=>setPage('menu')}>Volver al menú</button>
      </section>}
      {page==='explore'&&<section className="swipe-home">
        <div className="swipe-heading">
          <span className="eyebrow">TRUEKE PRG</span>
          <div className="swipe-search"><Search size={17}/><input value={query} onChange={e=>{setQuery(e.target.value);setCycleSeen([])}} placeholder="Buscar algo…"/></div>
        </div>
        {notice&&<div className="notice"><Check size={16}/>{notice}<button onClick={()=>setNotice('')}><X size={15}/></button></div>}
        {loading?<div className="loading">Cargando publicaciones…</div>:currentListing?<div className="swipe-stage">
          <article className="swipe-card" onTouchStart={e=>setSwipeStart(e.touches[0].clientX)} onTouchEnd={finishSwipe}>
            <div className="swipe-photo">{photos[currentListing.id]?<img src={photos[currentListing.id]} alt={currentListing.title}/>:<div className="photo-placeholder"><Tag size={35}/><span>TRUEQUE</span></div>}
              <span className="swipe-category">{currentListing.category || 'Juguetes y varios'}</span>
              <button type="button" className="swipe-report-btn" aria-label="Denunciar publicación" title="Denunciar publicación" onClick={()=>{setReportTarget({listingId:currentListing.id,userId:currentListing.user_id,title:currentListing.title});setReportReason(reasons[0]);setReportDetails('')}}><Flag size={16}/></button>
            </div>
            <div className="swipe-details">
              <div className="swipe-info-row">
                <div className="swipe-field swipe-user-field"><span>USUARIO:</span><strong>{currentListing.profiles?.display_name || 'Miembro de Trueke'}</strong></div>
                <div className="swipe-field swipe-product-field"><span>TIENE:</span><strong>{currentListing.title}</strong></div>
                <div className="swipe-field swipe-looking"><span>BUSCA:</span><strong>{currentListing.looking_for.split(/[,;]+/).map(tag=>tag.trim()).filter(Boolean).join(", ")}</strong></div>
              </div>
              <div className="swipe-field swipe-description-field"><span>DESCRIPCIÓN:</span><p className="swipe-description">{currentListing.description || 'Sin descripción'}</p></div>
              <div className="swipe-actions"><button className="swipe-no" disabled={swipeBusy} onClick={()=>swipeListing('left')} aria-label="No me interesa"><XCircle size={25}/><small>No me interesa</small></button><button className="swipe-yes" disabled={swipeBusy} onClick={()=>swipeListing('right')} aria-label="Me interesa"><Heart size={25}/><small>Me interesa</small></button></div>
            </div>
          </article>
        </div>:<div className="empty-state swipe-empty"><Handshake size={36}/><h3>Por ahora no hay más publicaciones</h3><p>Volvé más tarde o publicá algo para intercambiar.</p><button className="primary-btn" onClick={()=>setShowCreate(true)}><Plus size={17}/> Publicar algo</button></div>}
      </section>}
      {page==='matches'&&<section className="dashboard-section"><span className="eyebrow">TUS CONEXIONES</span><h1>Mis matches</h1><p className="muted">Cuando dos personas se interesan mutuamente, pueden coordinar por WhatsApp.</p>
        {matches.length===0&&<div className="empty-state"><Handshake size={34}/><h3>Todavía no tenés matches</h3><p>Marcá «Me interesa» en publicaciones. Si la otra persona también se interesa por algo tuyo, aparecerá acá.</p></div>}
        <div className="match-list">{matches.map(m=>{const c=contactMap[m.id];const mine=m.user_one===session.user.id?listings.find(l=>l.id===m.listing_one_id):listings.find(l=>l.id===m.listing_two_id);const theirs=m.user_one===session.user.id?listings.find(l=>l.id===m.listing_two_id):listings.find(l=>l.id===m.listing_one_id);const itemA=mine?.title||'tu publicación';const itemB=theirs?.title||'su publicación';const chatText=encodeURIComponent('¡Hola! Hicimos match en Trueke PRG por «'+itemA+'» y «'+itemB+'». ¿Coordinamos el intercambio?');return <article className="match-card" key={m.id}><div className="match-avatar">{(c?.display_name||'M').slice(0,1).toUpperCase()}</div><div className="match-info"><b>{c?.display_name||'Miembro de Trueke'}</b><small>Match confirmado · {new Date(m.created_at).toLocaleDateString('es-AR')}</small><span className="match-items">Artículos del match: <strong>{itemA}</strong> ↔ <strong>{itemB}</strong></span><span>{c?.phone||'Contacto protegido'}</span></div>{c?.phone&&<a className="whatsapp-btn" href={'https://wa.me/'+c.phone.replace(/\D/g,'')+'?text='+chatText} target="_blank" rel="noreferrer"><MessageCircle size={17}/> Abrir chat</a>}</article>})}</div>
        {incoming.length>0&&<><h2 className="subheading">Propuestas recibidas</h2>{incoming.map(p=><article className="proposal-card" key={p.id}><div><b>Propuesta directa</b><p>{p.message}</p><small>{new Date(p.created_at).toLocaleDateString('es-AR')}</small></div><button className="primary-btn" onClick={()=>acceptProposal(p.id)}><CheckCircle2 size={16}/> Aceptar y hacer match</button></article>)}</>}
        {outgoing.length>0&&<><h2 className="subheading">Propuestas enviadas</h2>{outgoing.map(p=><article className="proposal-card" key={p.id}><div><b>{p.status==='accepted'?'Aceptada':p.status==='rejected'?'Rechazada':'Pendiente'}</b><p>{p.message}</p></div></article>)}</>}
      </section>}
      {page==='admin'&&profile?.role==='admin'&&<section className="dashboard-section">
        <span className="eyebrow">PANEL PRIVADO</span><h1>Administración</h1>
        <p className="muted">Creá las cuentas y administrá quién puede ingresar a Trueke PRG.</p>
        <div className="create-modal" style={{margin:'24px 0',padding:24}}>
          <h2>Crear usuario</h2>
          <p className="muted">El teléfono queda autorizado y la cuenta se crea directamente. No hay registro libre.</p>
          <form className="create-form" onSubmit={createManagedMember}>
            <label>Teléfono (2964 + seis números)<input type="tel" inputMode="numeric" value={newMemberPhone} onChange={e=>setNewMemberPhone(e.target.value.replace(/\D/g,'').slice(0,10))} placeholder="2964XXXXXX" maxLength={10} pattern="2964[0-9]{6}" required/></label>
            <label>Nombre del usuario<input value={newMemberName} onChange={e=>setNewMemberName(e.target.value)} placeholder="Nombre y apellido" minLength={2} maxLength={60} required/></label>
            <label>Contraseña inicial<input type="text" value={newMemberPassword} onChange={e=>setNewMemberPassword(e.target.value)} placeholder="Mínimo 8 caracteres" minLength={8} required/></label>
            <button className="primary-btn" disabled={creatingMember}>{creatingMember?'Creando cuenta…':'Autorizar y crear cuenta'}</button>
          </form>
        </div>
        <div className="admin-section-head"><h2><Users size={19}/> Solicitudes de acceso</h2><span className="nav-count">{accessRequests.filter(r=>r.status==='pending').length} pendientes</span></div>
        {accessWhatsApp&&<div className="access-approved-box"><b>Acceso preparado para {accessWhatsApp.phone}</b><span>Contraseña provisoria: <code>{accessWhatsApp.password}</code></span><a className="whatsapp-btn" href={accessWhatsApp.url} target="_blank" rel="noreferrer"><MessageCircle size={17}/> Abrir WhatsApp y enviar acceso</a><small>El mensaje no se envía solo: se abre WhatsApp para que vos lo revises y lo envíes.</small></div>}
        {accessRequests.filter(r=>r.status==='pending').length===0?<p className="muted">No hay solicitudes pendientes.</p>:accessRequests.filter(r=>r.status==='pending').map(r=><article className="access-request-card" key={r.id}><div><b>{r.display_name}</b><span>{r.phone}</span><small>{new Date(r.created_at).toLocaleString('es-AR')}</small></div><div className="report-actions"><button disabled={accessBusy} onClick={()=>approveAccessRequest(r)}>{accessBusy?'Procesando…':'Autorizar y preparar WhatsApp'}</button><button onClick={()=>rejectAccessRequest(r)}>Rechazar</button></div></article>)}
        <div className="admin-section-head"><h2><ShieldCheck size={19}/> Teléfonos autorizados</h2><span className="muted">{authorizedPhones.length} números</span></div>
        <div className="member-list">{authorizedPhones.map(a=><article className="member-row" key={a.phone}><div className="member-info"><b>{a.phone}</b><span>{a.note||'Autorizado'}</span></div><span className={a.is_active?'member-state active':'member-state blocked'}>{a.is_active?'Autorizado':'Desactivado'}</span><button className="ban-btn" onClick={()=>removeAuthorizedPhone(a)}><X size={15}/> Eliminar</button></article>)}</div>
        <div className="admin-stats"><div><strong>{reports.filter(r=>r.status==='open').length}</strong><span>Denuncias pendientes</span></div><div><strong>{members.length}</strong><span>Miembros registrados</span></div><div><strong>{members.filter(m=>!m.is_active).length}</strong><span>Bloqueados</span></div></div>
        <div className="admin-section-head"><h2><Flag size={19}/> Denuncias</h2><button className="outline-btn" onClick={markNotificationsRead}>Marcar avisos leídos</button></div>
        {reports.length===0?<p className="muted">Todavía no hay denuncias.</p>:reports.map(r=><article className="report-card" key={r.id}><div className="report-main"><span className={'status-pill '+r.status}>{r.status==='open'?'Pendiente':r.status==='reviewed'?'Revisada':'Cerrada'}</span><b>{r.reason}</b><p>{r.details||'Sin detalles adicionales.'}</p><small>Denunció: <strong>{r.reporter?.display_name||'Usuario'}</strong> · Teléfono: <strong>{r.reporter?.phone||'No disponible'}</strong></small><small>Publicación: {r.listing_title||r.listing?.title||'Ya no disponible'} · {new Date(r.created_at).toLocaleString('es-AR')}</small></div><div className="report-actions"><button onClick={()=>updateReport(r,'reviewed')}>Revisada</button>{r.listing_id&&<button onClick={()=>deleteReportedListing(r)}>Eliminar publicación</button>}{r.reported_user&&<button onClick={()=>{const member=members.find(m=>m.id===r.reported_user);if(member)setMemberActive(member,false);else setNotice('No se encontró el usuario denunciado.')}}>Bloquear usuario</button>}<button onClick={()=>updateReport(r,'closed')}>Cerrar</button></div></article>)}
        <div className="admin-section-head"><h2><Users size={19}/> Miembros</h2><button className="outline-btn" onClick={()=>{setPasswordTarget(null);setTemporaryPassword('');setNewOwnPassword('');setPasswordModal(true)}}>Cambiar mi contraseña</button></div>
        <div className="member-list">{members.map(m=><article className="member-row" key={m.id}><div className="member-avatar">{(m.display_name||'U').slice(0,1).toUpperCase()}</div><div className="member-info"><b>{m.display_name||'Sin nombre'}</b><span>{m.phone}</span></div><span className={m.is_active?'member-state active':'member-state blocked'}>{m.is_active?'Activo':'Bloqueado'}</span><button className="reset-password-btn" onClick={()=>resetMemberPassword(m)}><ShieldCheck size={14}/> Contraseña</button>{m.role!=='admin'&&<button className={m.is_active?'ban-btn':'unban-btn'} onClick={()=>setMemberActive(m,!m.is_active)}>{m.is_active?<><Ban size={15}/> Bloquear</>:<><CheckCircle2 size={15}/> Habilitar</>}</button>}</article>)}</div>
        <div className="admin-section-head"><h2><Bell size={19}/> Avisos recientes</h2></div>
        {notifications.slice(0,8).map(n=><article className="notification-row" key={n.id}><span className={n.read_at?'read-dot':'unread-dot'}/><div><b>{n.title}</b><p>{n.body}</p><small>{new Date(n.created_at).toLocaleString('es-AR')}</small></div></article>)}
      </section>}
    </main>
    <footer className="footer"><a className="brand" href="#"><div className="brand-mark"><Handshake size={18}/></div><span>Trueke <b>Para Rio Grande</b></span></a><span>Una comunidad. Muchas posibilidades.</span><span>© 2026 Trueke PRG</span></footer>

    {passwordModal&&<div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget){setPasswordModal(false);setPasswordTarget(null);setTemporaryPassword('');setNewOwnPassword('')}}}><div className="create-modal password-modal"><div className="modal-head"><div><span className="eyebrow">SEGURIDAD DE LA CUENTA</span><h2>{passwordTarget?'Contraseña temporal':'Cambiar mi contraseña'}</h2><p>{passwordTarget?'Usuario: '+(passwordTarget.phone || passwordTarget.display_name):'Elegí una contraseña nueva para tu cuenta.'}</p></div><button className="icon-btn" onClick={()=>{setPasswordModal(false);setPasswordTarget(null);setTemporaryPassword('');setNewOwnPassword('')}}><X/></button></div>{passwordTarget?<div className="password-result">{passwordBusy?<p>Generando contraseña segura…</p>:temporaryPassword?<><p>Esta contraseña reemplazó la anterior. Copiala y entregásela al usuario por un canal privado. No volverá a mostrarse.</p><code>{temporaryPassword}</code><button className="primary-btn" onClick={()=>navigator.clipboard.writeText(temporaryPassword)}><Check size={16}/> Copiar contraseña</button></>:<p>Preparando…</p>}</div>:<form className="create-form" onSubmit={changeOwnPassword}><label>Nueva contraseña<input type="password" value={newOwnPassword} onChange={e=>setNewOwnPassword(e.target.value)} minLength={8} autoComplete="new-password" placeholder="Mínimo 8 caracteres" required/></label><button className="primary-btn" disabled={passwordBusy || newOwnPassword.length<8}>{passwordBusy?'Guardando…':'Guardar nueva contraseña'} <ArrowRight size={16}/></button></form>}</div></div>}
    {selectedListing&&<div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setSelectedListing(null)}}><div className="create-modal detail-modal"><div className="modal-head"><div><span className="eyebrow">DETALLE DEL INTERCAMBIO</span><h2>{selectedListing.title}</h2><p><MapPin size={13} style={{display:'inline',verticalAlign:'middle'}}/> {selectedListing.location||'Ubicación a coordinar'}</p></div><button className="icon-btn" onClick={()=>setSelectedListing(null)}><X/></button></div>{photos[selectedListing.id]&&<img className="detail-image" src={photos[selectedListing.id]} alt={selectedListing.title}/>}<div className="detail-copy"><span className="eyebrow">QUÉ OFRECE</span><p>{selectedListing.description||'El miembro no agregó detalles adicionales.'}</p><div className="swap-for"><span>BUSCA A CAMBIO</span><b>{selectedListing.looking_for}</b></div><div className="detail-owner"><div className="mini-avatar">{(selectedListing.profiles?.display_name||'U').slice(0,1).toUpperCase()}</div><span>Publicado por <b>{selectedListing.profiles?.display_name||'Miembro'}</b></span></div><div className="detail-buttons"><button className="interest-btn" onClick={()=>{addInterest(selectedListing);setSelectedListing(null)}}><Heart size={16}/> Me interesa</button>{selectedListing.user_id!==session.user.id&&<button className="primary-btn" onClick={()=>setProposalOpen(true)}><Send size={16}/> Proponer intercambio</button>}<button className="report-link" onClick={()=>{setReportTarget({listingId:selectedListing.id,userId:selectedListing.user_id,title:selectedListing.title});setSelectedListing(null)}}><Flag size={15}/> Reportar</button></div></div></div></div>}
    {proposalOpen&&selectedListing&&<div className="modal-backdrop"><div className="create-modal"><div className="modal-head"><div><span className="eyebrow">PROPUESTA DIRECTA</span><h2>Proponer un intercambio</h2><p>{selectedListing.title}</p></div><button className="icon-btn" onClick={()=>setProposalOpen(false)}><X/></button></div><form className="create-form" onSubmit={sendProposal}><label>Tu propuesta<textarea value={proposalText} onChange={e=>setProposalText(e.target.value)} rows={4} maxLength={1500} placeholder="Contale qué podés ofrecer a cambio…" required/></label><button className="primary-btn" disabled={!proposalText.trim()}>Enviar propuesta <ArrowRight size={16}/></button></form></div></div>}
    {reportTarget&&<div className="modal-backdrop"><div className="create-modal"><div className="modal-head"><div><span className="eyebrow">CUIDEMOS LA COMUNIDAD</span><h2>Reportar contenido</h2><p>La denuncia llegará al administrador.</p></div><button className="icon-btn" onClick={()=>setReportTarget(null)}><X/></button></div><form className="create-form" onSubmit={submitReport}><label>Motivo<select value={reportReason} onChange={e=>setReportReason(e.target.value)}>{reasons.map(r=><option key={r}>{r}</option>)}</select></label><label>Detalles (opcional)<textarea value={reportDetails} onChange={e=>setReportDetails(e.target.value)} rows={3} maxLength={1000} placeholder="Contanos qué pasó…"/></label><button className="primary-btn">Enviar denuncia <Flag size={16}/></button></form></div></div>}
    {showCreate&&<div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setShowCreate(false)}}><div className="create-modal"><div className="modal-head"><div><span className="eyebrow">HACÉ CIRCULAR LO QUE TENÉS</span><h2>Publicá tu trueque</h2><p>Podés tener hasta 4 publicaciones activas.</p></div><button className="icon-btn" onClick={()=>setShowCreate(false)}><X/></button></div><form onSubmit={publishListing} className="create-form">
      <label>¿Qué ofrecés?<input value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="Ej. Bicicleta rodado 29" maxLength={30} required/></label>
      <label>Contá un poco más<textarea value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder="Estado, medidas o detalles…" rows={2} maxLength={60}/></label>
      <label>¿Qué te gustaría recibir a cambio?<input value={form.looking_for} onChange={e=>setForm({...form,looking_for:e.target.value})} placeholder="Ej. Una mesa, herramientas…" maxLength={30} required/></label>
      <label>¿A qué categoría pertenece?<select value={formCategory} onChange={e=>setFormCategory(e.target.value)} required><option value="">Elegí una categoría</option>{categories.map(category=><option key={category} value={category}>{category}</option>)}</select></label>
      <p className="location-fixed"><MapPin size={15}/> Publicaciones de Río Grande</p>
      <div className="upload-area"><label className="upload-label"><ImagePlus size={20}/><span><b>Sumá una foto *</b><small>Obligatoria · una imagen por publicación · se optimiza automáticamente</small></span><input type="file" accept="image/*" onChange={e=>selectImages(e.target.files)} hidden/></label><div className="image-count">{images.length}/1</div></div>
      {images.length>0&&<div className="selected-files">{images.map((f,i)=><span key={i}>{f.name}<button type="button" onClick={()=>setImages(images.filter((_,j)=>j!==i))}><X size={13}/></button></span>)}</div>}
      <div className="form-foot"><span><ShieldCheck size={15}/> Publicación automática para todos los miembros.</span><button className="primary-btn" disabled={saving}>{saving?'Publicando…':'Publicar trueque'} <ArrowRight size={16}/></button></div>
    </form></div></div>}
  </div>;
}

export default App;
