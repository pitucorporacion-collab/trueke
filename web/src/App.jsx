import React, { useEffect, useMemo, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  ArrowLeft, ArrowRight, ArrowUpRight, Bell, Check, Heart, ImagePlus, Smartphone, LogOut, Menu, XCircle,
  MapPin, Plus, Search, ShieldCheck, Tag, X, MessageCircle, Flag,
  Users, Ban, CheckCircle2, Send, Handshake, AlertTriangle
} from 'lucide-react';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;
const reasons = ['Venta de dinero o precios', 'Contenido inapropiado', 'Posible estafa', 'Spam', 'Otro'];

function normalizeModerationText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[0-9@$!]/g, char => ({'0':'o','1':'i','2':'z','3':'e','4':'a','5':'s','6':'g','7':'t','8':'b','9':'g','@':'a','$':'s','!':'i'}[char]))
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isBlockedDisplayName(value, terms) {
  const normalized = normalizeModerationText(value);
  const compact = normalized.replace(/\s/g, '');
  return (terms || []).some(item => {
    const term = normalizeModerationText(item.term || item);
    if (!term) return false;
    return (' ' + normalized + ' ').includes(' ' + term + ' ')
      || (/^[a-z0-9](?: [a-z0-9]){2,}$/.test(normalized) && compact === term);
  });
}

function App() {
  const [session,setSession] = useState(null);
  const [profile,setProfile] = useState(null);
  const [displayNameDraft,setDisplayNameDraft] = useState('');
  const [displayNameBusy,setDisplayNameBusy] = useState(false);
  const [blockedNameTerms,setBlockedNameTerms] = useState([]);
  const [newBlockedTerm,setNewBlockedTerm] = useState('');
  const [blockedTermsBusy,setBlockedTermsBusy] = useState(false);
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
  const [accessWhatsApps,setAccessWhatsApps] = useState([]);
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
  const [appInstalled,setAppInstalled] = useState(() => typeof window !== 'undefined' && (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true));
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
    let knownRequestIds = null;
    const refreshAdminData = async () => {
      const [{data:notificationRows},{data:requestRows,error:requestError}] = await Promise.all([
        supabase.from('admin_notifications').select('*').order('created_at',{ascending:false}).limit(30),
        supabase.from('access_requests').select('*').order('created_at',{ascending:false})
      ]);
      if (notificationRows) setNotifications(notificationRows);
      if (requestError) return;
      const rows = requestRows || [];
      const pending = rows.filter(row => row.status === 'pending');
      if (knownRequestIds !== null) {
        const newRequests = pending.filter(row => !knownRequestIds.has(row.id));
        if (newRequests.length) {
          setNotice(newRequests.length === 1
            ? '¡Nueva solicitud de acceso! Revisá el apartado Solicitudes de acceso.'
            : '¡Llegaron ' + newRequests.length + ' nuevas solicitudes de acceso! Revisá el apartado Solicitudes de acceso.');
        }
      }
      knownRequestIds = new Set(rows.map(row => row.id));
      setAccessRequests(rows);
    };
    refreshAdminData();
    const timer = window.setInterval(refreshAdminData, 10000);
    return () => window.clearInterval(timer);
  }, [session, profile?.role]);

  async function loadData() {
    setLoading(true);
    const [{data:me},{data:rows,error}] = await Promise.all([
      supabase.from('profiles').select('id,display_name,phone,role,is_active,created_at').eq('id',session.user.id).single(),
      supabase.from('listings').select('*, profiles(display_name), listing_images(id,storage_path,sort_order)').or('status.eq.published,user_id.eq.'+session.user.id).order('created_at',{ascending:false})
    ]);
    setProfile(me || null);
    setDisplayNameDraft(me?.display_name || '');
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
      const [{data:reportRows},{data:notificationRows},{data:memberRows},{data:requestRows},{data:blockedTermsRows}] = await Promise.all([
        supabase.from('reports').select('*, reporter:profiles!reports_reporter_id_fkey(display_name,phone), listing:listings!reports_listing_id_fkey(title)').order('created_at',{ascending:false}),
        supabase.from('admin_notifications').select('*').order('created_at',{ascending:false}).limit(30),
        supabase.rpc('admin_get_members'),
        supabase.from('access_requests').select('*').order('created_at',{ascending:false}),
        supabase.rpc('admin_manage_display_name_terms',{p_action:'list',p_term:null})
      ]);
      setReports(reportRows || []);
      setBlockedNameTerms(blockedTermsRows || []);
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
    if (requestName.trim().length < 3 || requestName.trim().length > 25) { setRequestFeedback('El nombre debe tener entre 3 y 25 caracteres.'); return; }
    if (!supabase) { setRequestFeedback('El servicio no está disponible en este momento. Intentá nuevamente.'); return; }
    setRequestSending(true);
    try {
      const {error} = await supabase.from('access_requests').insert({display_name:requestName.trim(),phone:cleanPhone});
      if (error?.code === '23505') setRequestFeedback('Ya existe una solicitud pendiente para ese número. No hace falta enviarla otra vez.');
      else if (error) setRequestFeedback(error.message?.toLowerCase().includes('nombre') || error.message?.toLowerCase().includes('permitido') ? error.message : 'No pudimos enviar la solicitud. Revisá tus datos e intentá nuevamente.');
      else {
        setRequestFeedback('Tu solicitud fue registrada. Cuando se habilite tu acceso, te enviaremos tu usuario y contraseña por WhatsApp.');
        setRequestName(''); setRequestPhone('');
      }
    } catch (err) {
      setRequestFeedback('No pudimos conectar con el servicio. Intentá nuevamente en unos minutos.');
    } finally {
      setRequestSending(false);
    }
  }

  const PASSWORD_WORDS = ["luna","pato","gato","casa","mesa","sapo","lobo","rana","pino","rosa","flor","nube","copa","taza","vaso","tela","lana","pelo","mano","dedo","boca","cara","ojos","puma","leon","mono","foca","mula","vaca","pera","kiwi","mora","nuez","lima","miel","coco","mate","cafe","vino","agua","jugo","taco","sopa","pala","pico","remo","bote","vela","tren","auto","moto","ruta","lago","isla","cabo","roca","piso","reja","caja","nota","hoja","tiza","mapa","foto","cine","arte","arpa","bajo","solo","alto","azul","rojo","gris","ocre","frio","vivo","risa","amor","vida","alma","idea","jefe","obra","dato","plan","meta","hora","ayer","cero","tres","seis","ocho","diez","once","doce","seda","lino","puro","rico","fino","sano","leal","real","unir","usar","leer","reir","toma","mira","abre","sale","sube","baja","gira","pasa","para","faro","foco","humo","aire","rayo","rama","nido","cola","pata","piel","muro","teja","cama","sofa","cuna","cubo","tubo","tapa","tina","onda","lira","coro","tema","rima","base","nodo","chat","mail","bits","byte","chip","modo","menu","clan","hijo","tata","nene","nena","bebe","mama","papa","guia","cura","juez","dama","chef","pila","bota","ropa","anil","joya","gema","jade","topo","polo","golf","judo","surf","giro","dado","peon","torre"];

  function makeTemporaryPassword() {
    const randomIndex = (max) => {
      const range = 0x100000000;
      const limit = range - (range % max);
      const value = new Uint32Array(1);
      do { crypto.getRandomValues(value); } while (value[0] >= limit);
      return value[0] % max;
    };
    const first = PASSWORD_WORDS[randomIndex(PASSWORD_WORDS.length)];
    const number = String(randomIndex(100)).padStart(2, '0');
    const second = PASSWORD_WORDS[randomIndex(PASSWORD_WORDS.length)];
    return first + number + second;
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
      setAccessWhatsApps(previous=>[...previous,{id:request.id,displayName:request.display_name,phone:request.phone,password:tempPassword,url:'https://wa.me/549'+request.phone+'?text='+encodeURIComponent(message)}]);
      setNotice('Solicitud aprobada. Abrí WhatsApp para enviarle el acceso.');
      await loadData();
    } catch(err) { setNotice(err.message || 'No se pudo autorizar la solicitud.'); }
    finally { setAccessBusy(false); }
  }

  function removeAccessWhatsApp(id) {
    setAccessWhatsApps(previous=>previous.filter(item=>item.id!==id));
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
    if (newMemberName.trim().length < 3 || newMemberName.trim().length > 25) { setNotice('El nombre debe tener entre 3 y 25 caracteres.'); return; }
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

  async function deleteMember(member) {
    if (!member?.id || member.id === session?.user?.id) return;
    const label = member.display_name || member.phone || 'este usuario';
    if (!window.confirm('¿Eliminar definitivamente la cuenta de '+label+'? Se borrarán su perfil, publicaciones, intereses y datos asociados. Esta acción no se puede deshacer.')) return;
    setAccessBusy(true);
    const {data,error} = await supabase.functions.invoke('admin-user-management',{body:{action:'delete_user',user_id:member.id}});
    setAccessBusy(false);
    if (error || data?.error) {
      setNotice(data?.error || error?.message || 'No se pudo eliminar la cuenta.');
      return;
    }
    setNotice('Cuenta de '+label+' eliminada definitivamente.');
    await loadData();
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

  async function saveDisplayName(e) {
    e.preventDefault();
    const cleanName = displayNameDraft.trim().replace(/\s+/g, ' ');
    if (cleanName.length < 3 || cleanName.length > 25) {
      setNotice('El nombre visible debe tener entre 3 y 25 caracteres.');
      return;
    }
    if (isBlockedDisplayName(cleanName, blockedNameTerms)) {
      setNotice('Ese nombre contiene una palabra no permitida. Probá con otro nombre.');
      return;
    }
    setDisplayNameBusy(true);
    setNotice('');
    const {data,error} = await supabase.from('profiles')
      .update({display_name:cleanName})
      .eq('id',session.user.id)
      .select('id,display_name,phone,role,is_active,created_at')
      .single();
    setDisplayNameBusy(false);
    if (error) {
      setNotice(error.message?.includes('nombre') || error.message?.includes('permitido')
        ? error.message
        : 'No se pudo cambiar el nombre. Revisá que cumpla las reglas e intentá nuevamente.');
      return;
    }
    setProfile(data);
    setDisplayNameDraft(data.display_name);
    setNotice('Nombre visible actualizado correctamente.');
    await loadData();
  }

  async function addBlockedNameTerm(e) {
    e.preventDefault();
    const term = newBlockedTerm.trim();
    if (term.length < 2 || term.length > 40) {
      setNotice('La palabra o expresión debe tener entre 2 y 40 caracteres.');
      return;
    }
    setBlockedTermsBusy(true);
    const {data,error} = await supabase.rpc('admin_manage_display_name_terms',{p_action:'add',p_term:term});
    setBlockedTermsBusy(false);
    if (error) setNotice(error.message || 'No se pudo agregar la palabra.');
    else {
      setBlockedNameTerms(data || []);
      setNewBlockedTerm('');
      setNotice('Palabra agregada al filtro.');
    }
  }

  async function removeBlockedNameTerm(term) {
    if (!window.confirm('¿Quitar «' + term + '» de las palabras prohibidas?')) return;
    setBlockedTermsBusy(true);
    const {data,error} = await supabase.rpc('admin_manage_display_name_terms',{p_action:'remove',p_term:term});
    setBlockedTermsBusy(false);
    if (error) setNotice(error.message || 'No se pudo quitar la palabra.');
    else {
      setBlockedNameTerms(data || []);
      setNotice('Palabra quitada del filtro.');
    }
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

  if (!session && accessRequestOpen) return <main className="access-request-screen">
    <section className="access-request-card">
      <button type="button" className="access-request-back" onClick={()=>{setAccessRequestOpen(false);setRequestFeedback('')}}><ArrowLeft size={18}/> Volver al inicio</button>
      <div className="brand-mark"><Handshake size={23}/></div>
      <span className="eyebrow">BIENVENIDO A TRUEKE PRG</span>
      <h1>Solicitá tu usuario</h1>
      <p className="muted">Completá tus datos y, cuando se habilite tu acceso, te enviaremos tu usuario y contraseña por WhatsApp.</p>
      {requestFeedback.startsWith('¡') ? <div className="request-confirmation" role="status" aria-live="polite"><CheckCircle2 size={28}/><h2>¡Solicitud enviada!</h2><p>{requestFeedback}</p><button type="button" className="primary-btn full" onClick={()=>{setAccessRequestOpen(false);setRequestFeedback('')}}>Volver al inicio</button></div> : <form className="access-request-form" onSubmit={submitAccessRequest}>
        <label>Tu teléfono<input type="tel" inputMode="numeric" autoComplete="tel" value={requestPhone} onChange={e=>setRequestPhone(e.target.value.replace(/\D/g,'').slice(0,10))} placeholder="2964XXXXXX" maxLength={10} pattern="2964[0-9]{6}" required/><small>Usá 2964 seguido de otros 6 números.</small></label>
        <label>Tu nombre y apellido<input autoComplete="name" value={requestName} onChange={e=>setRequestName(e.target.value)} placeholder="Ej.: María Pérez" minLength={3} maxLength={25} required/><small>Este será tu nombre visible en Trueke PRG.</small></label>
        {requestFeedback&&<div role="alert" className="request-feedback error">{requestFeedback}</div>}
        <button className="primary-btn full" disabled={requestSending}>{requestSending?'Enviando…':'Enviar solicitud'} <ArrowRight size={17}/></button>
      </form>}
      <div className="access-request-foot">TRUEKE PRG <span>·</span> Trueke para Río Grande</div>
    </section>
  </main>;

  if (!session && !appInstalled && !accessRequestOpen) return <main className="auth-shell install-required-shell">
    <section className="auth-panel install-required-panel">
      <div className="mobile-brand"><div className="brand-mark"><Handshake size={22}/></div><span>Trueke <b>Para Rio Grande</b></span></div>
      <div className="auth-card install-required-card">
        <span className="eyebrow">UNA MEJOR EXPERIENCIA</span>
        <h2>Instalá Trueke PRG</h2>
        <p className="muted">Para usar Trueke, primero instalá la aplicación en tu celular. Así se abre en pantalla completa y evitás usarla desde el navegador.</p>
        <button type="button" className="primary-btn full install-main-btn" onClick={installApp}><Smartphone size={19}/> Instalar Trueke PRG <ArrowRight size={17}/></button>
        {installHelp && <div className="install-help" role="status"><b>Cómo instalar Trueke</b><span>Android: en Chrome, tocá ⋮ y elegí “Instalar aplicación” o “Agregar a pantalla principal”.</span><span>iPhone: en Safari, tocá Compartir y elegí “Agregar a pantalla de inicio”.</span><span>Después abrí Trueke desde el ícono que se agregó al teléfono.</span></div>}
        {!installPrompt && <p className="install-required-note">Si no aparece el aviso de instalación, usá las instrucciones de arriba.</p>}
      </div>
      <div className="panel-bottom">TRUEKE PRG <span>·</span> Trueke para Río Grande</div>
    </section>
  </main>;

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
        <div className="request-user"><span>¿Todavía no tenés usuario?</span><button type="button" onClick={()=>{setAccessRequestOpen(true);setRequestFeedback('')}} className="request-user-btn">Solicitar mi usuario</button></div>
      </div>
      <div className="panel-bottom">TRUEKE PRG <span>·</span> Trueke para Río Grande</div>
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
        <div className="account-summary"><div className="avatar account-avatar">{(profile?.display_name||'U').slice(0,1).toUpperCase()}</div><div><b>{profile?.display_name||'Mi cuenta'}</b><span>Tu perfil en la comunidad</span></div></div>
        <form className="create-form account-name-form" onSubmit={saveDisplayName}>
          <label>Nombre visible<input value={displayNameDraft} onChange={e=>setDisplayNameDraft(e.target.value)} minLength={3} maxLength={25} placeholder="Cómo querés aparecer" required/></label>
          <small>Este nombre aparece en tus publicaciones y matches. Podés cambiarlo cuando quieras.</small>
          <button className="primary-btn" disabled={displayNameBusy || displayNameDraft.trim().length<3}>{displayNameBusy?'Guardando…':'Guardar nombre visible'} <ArrowRight size={16}/></button>
        </form>
        <div className="account-phone-lock"><span>TELÉFONO DE ACCESO</span><b>{profile?.phone || 'No disponible'}</b><small>Este dato identifica tu cuenta y no se puede cambiar desde la aplicación.</small></div>
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
      {page==='admin'&&profile?.role==='admin'&&<section className="dashboard-section admin-dashboard">
        <span className="eyebrow">PANEL PRIVADO</span><h1>Administración</h1>
        {notice&&<div className="notice admin-notice" role="status"><Check size={16}/>{notice}<button onClick={()=>setNotice('')}><X size={15}/></button></div>}
        <div className="create-modal" style={{margin:'24px 0',padding:24}}>
          <h2>Crear usuario</h2>
          <p className="muted">El teléfono queda autorizado y la cuenta se crea directamente. No hay registro libre.</p>
          <form className="create-form" onSubmit={createManagedMember}>
            <label>Teléfono (2964 + seis números)<input type="tel" inputMode="numeric" value={newMemberPhone} onChange={e=>setNewMemberPhone(e.target.value.replace(/\D/g,'').slice(0,10))} placeholder="2964XXXXXX" maxLength={10} pattern="2964[0-9]{6}" required/></label>
            <label>Nombre visible<input value={newMemberName} onChange={e=>setNewMemberName(e.target.value)} placeholder="Nombre y apellido" minLength={3} maxLength={25} required/></label>
            <label>Contraseña inicial<input type="text" value={newMemberPassword} onChange={e=>setNewMemberPassword(e.target.value)} placeholder="Mínimo 8 caracteres" minLength={8} required/></label>
            <button className="primary-btn" disabled={creatingMember}>{creatingMember?'Creando cuenta…':'Autorizar y crear cuenta'}</button>
          </form>
        </div>
        <div className="admin-section-head"><h2><Users size={19}/> Solicitudes de acceso</h2><span className="nav-count">{accessRequests.filter(r=>r.status==='pending').length} pendientes</span></div>
        {accessWhatsApps.map(item=><div className="access-approved-box" key={item.id}><b>Acceso preparado para {item.displayName} · {item.phone}</b><span>Contraseña provisoria: <code>{item.password}</code></span><a className="whatsapp-btn" href={item.url} target="_blank" rel="noreferrer"><MessageCircle size={17}/> Abrir WhatsApp y enviar acceso</a><small>Cuando termines de enviarlo, tocá “Enviado, quitar de pendientes”.</small><div className="report-actions"><button onClick={()=>removeAccessWhatsApp(item.id)}>Enviado, quitar de pendientes</button><button className="ban-btn" onClick={()=>removeAccessWhatsApp(item.id)}>Eliminar</button></div></div>)}
        {accessRequests.filter(r=>r.status==='pending').length===0?<p className="muted">No hay solicitudes pendientes.</p>:accessRequests.filter(r=>r.status==='pending').map(r=><article className="access-request-card" key={r.id}><div><b>{r.display_name}</b><span>{r.phone}</span><small>{new Date(r.created_at).toLocaleString('es-AR')}</small></div><div className="report-actions"><button disabled={accessBusy} onClick={()=>approveAccessRequest(r)}>{accessBusy?'Procesando…':'Autorizar y preparar WhatsApp'}</button><button onClick={()=>rejectAccessRequest(r)}>Rechazar</button></div></article>)}
        <div className="admin-section-head"><h2><ShieldCheck size={19}/> Usuarios y teléfonos</h2><span className="muted">{members.length} cuentas · {authorizedPhones.length} autorizaciones</span><button className="outline-btn" onClick={()=>{setPasswordTarget(null);setTemporaryPassword('');setNewOwnPassword('');setPasswordModal(true)}}>Cambiar mi contraseña</button></div>
        <div className="member-list authorized-phone-list">{[...members.map(member=>({member,authorized:authorizedPhones.find(a=>String(a.phone||'').replace(/\D/g,'').replace(/^549/,'')===String(member.phone||'').replace(/\D/g,'').replace(/^549/,''))})),...authorizedPhones.filter(a=>!members.some(member=>String(member.phone||'').replace(/\D/g,'').replace(/^549/,'')===String(a.phone||'').replace(/\D/g,'').replace(/^549/,''))).map(authorized=>({member:null,authorized}))].map(({member,authorized:a})=>{const phoneValue=member?.phone||a?.phone||'';const active=member?member.is_active!==false&&(!a||a.is_active):a?.is_active;return <article className="member-row" key={member?.id||a.phone}><div className="member-avatar">{(member?.display_name||'U').slice(0,1).toUpperCase()}</div><div className="member-info"><b>{member?.display_name||'Sin cuenta creada'}</b><span>{phoneValue}</span></div><span className={active?'member-state active':'member-state blocked'}>{active?'Activo':'Bloqueado'}</span>{member&&<><button className="reset-password-btn" onClick={()=>resetMemberPassword(member)}><ShieldCheck size={14}/> Contraseña</button>{member.role!=='admin'&&<><button className={member.is_active?'ban-btn':'unban-btn'} onClick={()=>setMemberActive(member,!member.is_active)}>{member.is_active?<><Ban size={15}/> Bloquear</>:<><CheckCircle2 size={15}/> Habilitar</>}</button>{member.id!==session?.user?.id&&<button className="ban-btn" disabled={accessBusy} onClick={()=>deleteMember(member)}><XCircle size={15}/> Eliminar cuenta</button>}</>}</>}{a&&<button className="ban-btn" onClick={()=>removeAuthorizedPhone(a)}><X size={15}/> Quitar autorización</button>}</article>})}</div>
        <section className="admin-blocked-terms">
           <div className="admin-section-head"><h2><ShieldCheck size={19}/> Filtro de nombres</h2><span className="muted">{blockedNameTerms.length} palabras y expresiones</span></div>
           <p className="muted">Estas palabras se rechazan al guardar un nombre visible. El filtro también reconoce números y signos usados para disimularlas.</p>
           <form className="blocked-term-form" onSubmit={addBlockedNameTerm}>
             <input value={newBlockedTerm} onChange={e=>setNewBlockedTerm(e.target.value)} maxLength={40} placeholder="Agregar palabra o expresión…" aria-label="Nueva palabra prohibida"/>
             <button className="primary-btn" disabled={blockedTermsBusy || newBlockedTerm.trim().length<2}>{blockedTermsBusy?'Guardando…':'Agregar'}</button>
           </form>
           <div className="blocked-term-list">{blockedNameTerms.map(item=><span className="blocked-term-chip" key={item.id || item.term}>{item.term}<button type="button" aria-label={'Quitar '+item.term} disabled={blockedTermsBusy} onClick={()=>removeBlockedNameTerm(item.term)}><X size={13}/></button></span>)}</div>
         </section>
         <div className="admin-stats"><div><strong>{reports.filter(r=>r.status==='open').length}</strong><span>Denuncias pendientes</span></div><div><strong>{members.length}</strong><span>Miembros registrados</span></div><div><strong>{members.filter(m=>!m.is_active).length}</strong><span>Bloqueados</span></div></div>
        <div className="admin-section-head"><h2><Flag size={19}/> Denuncias</h2><button className="outline-btn" onClick={markNotificationsRead}>Marcar avisos leídos</button></div>
        {reports.length===0?<p className="muted">Todavía no hay denuncias.</p>:reports.map(r=><article className="report-card" key={r.id}><div className="report-main"><span className={'status-pill '+r.status}>{r.status==='open'?'Pendiente':r.status==='reviewed'?'Revisada':'Cerrada'}</span><b>{r.reason}</b><p>{r.details||'Sin detalles adicionales.'}</p><small>Denunció: <strong>{r.reporter?.display_name||'Usuario'}</strong> · Teléfono: <strong>{r.reporter?.phone||'No disponible'}</strong></small><small>Publicación: {r.listing_title||r.listing?.title||'Ya no disponible'} · {new Date(r.created_at).toLocaleString('es-AR')}</small></div><div className="report-actions"><button onClick={()=>updateReport(r,'reviewed')}>Revisada</button>{r.listing_id&&<button onClick={()=>deleteReportedListing(r)}>Eliminar publicación</button>}{r.reported_user&&<button onClick={()=>{const member=members.find(m=>m.id===r.reported_user);if(member)setMemberActive(member,false);else setNotice('No se encontró el usuario denunciado.')}}>Bloquear usuario</button>}<button onClick={()=>updateReport(r,'closed')}>Cerrar</button></div></article>)}
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
