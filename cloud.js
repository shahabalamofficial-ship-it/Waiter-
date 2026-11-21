/* Yasmine Palace Trainer - cloud and personal content layer.
   Original 30-day curriculum and menu data remain in index.html as the protected baseline.
   Personal records are stored in Supabase per authenticated user and cached locally. */
(() => {
  "use strict";
  const cfg = window.YP_CONFIG || {};
  const configured = /^https:\/\/[^/]+\.supabase\.co$/.test(cfg.supabaseUrl||"") &&
    !!cfg.supabaseAnonKey && !String(cfg.supabaseAnonKey).includes("YOUR_");
  let client = null, user = null, customLessons = [], customDishes = [], photos = [], notes = [], panelOpen = false;
  const $ = (s, r=document) => r.querySelector(s);
  const esc = s => String(s ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const status = (msg, bad=false) => { const el=$("#yp-cloud-status"); if(el){el.textContent=msg;el.style.color=bad?"var(--rd)":"var(--gn)";} };
  const localSnapshot = () => ({
    app:"yasmine-palace-trainer", version:1, saved_at:new Date().toISOString(),
    progress: JSON.parse(localStorage.getItem("ypd")||"{}"),
    best_test: Number(localStorage.getItem("ypdb2")||0),
    duty_hours: JSON.parse(localStorage.getItem("ypdh")||"[]"),
    theme: localStorage.getItem("ypdt")||"dark",
    custom_lessons: JSON.parse(localStorage.getItem("yp_custom_lessons")||"[]"),
    custom_dishes: JSON.parse(localStorage.getItem("yp_custom_dishes")||"[]"),
    notes: JSON.parse(localStorage.getItem("yp_personal_notes")||"[]")
  });
  const saveLocal = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch(e) { console.error(e); } };
  const getLocal = (key) => { try { return JSON.parse(localStorage.getItem(key)||"[]"); } catch(e){ return []; } };
  function panel(){
    return `<div class="cloud-wrap"><button class="cloud-btn alt" id="yp-back">← Back to app</button>
      <div class="cloud-panel"><h2>Account & Cloud Sync</h2>
        <p class="cloud-muted">Sign in with an email verification code. Your original 30-day lessons and menu remain the protected baseline.</p>
        <div id="yp-cloud-status" class="cloud-status">${configured?"Not signed in.":"Cloud is not configured yet. Add your Supabase project URL and public key in config.js."}</div>
        <div id="yp-auth">
          <input id="yp-email" class="cloud-field" type="email" autocomplete="email" placeholder="Your email address">
          <div class="cloud-row"><button class="cloud-btn" id="yp-send-code">Send verification code</button></div>
          <input id="yp-otp" class="cloud-field" inputmode="numeric" autocomplete="one-time-code" placeholder="6-digit email code">
          <div class="cloud-row"><button class="cloud-btn" id="yp-verify">Verify & sign in</button><button class="cloud-btn alt" id="yp-signout">Sign out</button></div>
        </div>
        <div class="cloud-row"><button class="cloud-btn alt" id="yp-sync">Sync my data</button><button class="cloud-btn alt" id="yp-export">Download data backup</button><button class="cloud-btn alt" id="yp-import">Restore JSON backup</button></div>
        <p class="cloud-muted">Status is shown honestly. A green message means the server confirmed the action. Offline data stays on this device until a successful sync.</p>
      </div>
      <div class="cloud-panel"><h2>My Lessons</h2><p class="cloud-muted">Create your own lessons. Built-in professional lessons are not edited or deleted by this tool.</p>
        <input id="yl-title" class="cloud-field" placeholder="Lesson title">
        <textarea id="yl-body" class="cloud-field" rows="4" placeholder="What should you learn? Add steps, examples and guest phrases."></textarea>
        <button class="cloud-btn" id="yl-add">Save personal lesson</button>
        <div id="yl-list"></div>
      </div>
      <div class="cloud-panel"><h2>My Menu Dishes</h2><p class="cloud-muted">Add personal study entries separately from the supplied restaurant menu. Confirm ingredients and allergens with your kitchen.</p>
        <input id="yd-name" class="cloud-field" placeholder="Dish name">
        <input id="yd-category" class="cloud-field" placeholder="Category (e.g. Cold Mezze)">
        <textarea id="yd-ingredients" class="cloud-field" rows="3" placeholder="Ingredients exactly as confirmed by the restaurant"></textarea>
        <textarea id="yd-description" class="cloud-field" rows="2" placeholder="Guest-friendly description"></textarea>
        <div class="cloud-row"><button class="cloud-btn" id="yd-add">Save personal dish</button><button class="cloud-btn alt" id="yd-search">Find reference photos</button></div>
        <div id="yd-list"></div><div id="yd-photo-search" class="cloud-muted"></div>
      </div>
      <div class="cloud-panel"><h2>Personal Notes</h2><p class="cloud-muted">Keep notes from training, shift feedback and questions to ask your supervisor.</p>
        <textarea id="yn-text" class="cloud-field" rows="4" placeholder="Write your note..."></textarea>
        <button class="cloud-btn" id="yn-save">Save note</button><div id="yn-list"></div>
      </div>
      <div class="cloud-panel"><h2>Data safety</h2>
        <ul><li>Local browser storage is not a guaranteed backup.</li><li>Cloud sync requires a configured Supabase project, working internet and a signed-in account.</li><li>Photos uploaded to cloud storage are private to your account under the included SQL policies.</li><li>Keep a downloaded JSON backup too. This export currently covers structured records, not image binaries.</li></ul>
      </div>
    </div>`;
  }
  function renderLessons(){
    const el=$("#yl-list"); if(!el)return;
    el.innerHTML=customLessons.length?customLessons.map(x=>`<div class="cloud-item"><strong>${esc(x.title)}</strong><p>${esc(x.body)}</p><div class="cloud-row"><button class="cloud-btn alt" data-edit-lesson="${esc(x.id)}">Edit</button><button class="cloud-btn alt cloud-danger" data-del-lesson="${esc(x.id)}">Delete</button></div></div>`).join(""):"<p class='cloud-muted'>No personal lessons yet.</p>";
  }
  function renderDishes(){
    const el=$("#yd-list"); if(!el)return;
    el.innerHTML=customDishes.length?customDishes.map(x=>`<div class="cloud-item"><strong>${esc(x.name)} · ${esc(x.category||"Uncategorised")}</strong><p>${esc(x.ingredients)}</p><p>${esc(x.description||"")}</p><div class="cloud-row"><button class="cloud-btn alt" data-photo-dish="${esc(x.id)}">Add photos</button><button class="cloud-btn alt cloud-danger" data-del-dish="${esc(x.id)}">Delete</button></div>${photos.filter(p=>p.dish_id===x.id).map(p=>`<p class="cloud-muted">Photo saved: ${esc(p.file_name||"image")}</p>`).join("")}</div>`).join(""):"<p class='cloud-muted'>No personal dishes yet.</p>";
  }
  function renderNotes(){
    const el=$("#yn-list"); if(!el)return;
    el.innerHTML=notes.map(x=>`<div class="cloud-item"><p>${esc(x.body)}</p><small class="cloud-muted">${new Date(x.updated_at||x.created_at||Date.now()).toLocaleString()}</small><button class="cloud-btn alt cloud-danger" data-del-note="${esc(x.id)}">Delete</button></div>`).join("")||"<p class='cloud-muted'>No notes yet.</p>";
  }
  function download(name, data, type="application/json"){
    const a=document.createElement("a"),u=URL.createObjectURL(new Blob([data],{type}));
    a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),1000);
  }
  function initClient(){
    if(!configured || !window.supabase?.createClient) return false;
    client=window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseAnonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
    return true;
  }
  async function loadCloud(){
    if(!client||!user)return;
    const localL=getLocal("yp_custom_lessons"),localD=getLocal("yp_custom_dishes"),localN=getLocal("yp_personal_notes");
    const [l,d,n,m]=await Promise.all([
      client.from("personal_lessons").select("*").order("updated_at",{ascending:false}),
      client.from("personal_dishes").select("*").order("updated_at",{ascending:false}),
      client.from("personal_notes").select("*").order("updated_at",{ascending:false}),
      client.from("dish_media").select("*").order("created_at",{ascending:false})
    ]);
    for(const x of [l,d,n,m]) if(x.error) throw x.error;
    // Migrate locally created records on first sign-in, retaining their UUIDs.
    const pendingL=localL.filter(x=>!(l.data||[]).some(y=>y.id===x.id)).map(({id,title,body,created_at,updated_at})=>({id,user_id:user.id,title,body,created_at,updated_at}));
    const pendingD=localD.filter(x=>!(d.data||[]).some(y=>y.id===x.id)).map(({id,name,category,ingredients,description,created_at,updated_at})=>({id,user_id:user.id,name,category,ingredients,description,created_at,updated_at}));
    const pendingN=localN.filter(x=>!(n.data||[]).some(y=>y.id===x.id)).map(({id,body,created_at,updated_at})=>({id,user_id:user.id,body,created_at,updated_at}));
    if(pendingL.length){const r=await client.from("personal_lessons").upsert(pendingL,{onConflict:"id",ignoreDuplicates:true});if(r.error)throw r.error;}
    if(pendingD.length){const r=await client.from("personal_dishes").upsert(pendingD,{onConflict:"id",ignoreDuplicates:true});if(r.error)throw r.error;}
    if(pendingN.length){const r=await client.from("personal_notes").upsert(pendingN,{onConflict:"id",ignoreDuplicates:true});if(r.error)throw r.error;}
    if(pendingL.length||pendingD.length||pendingN.length){return loadCloud();}
    customLessons=l.data||[];customDishes=d.data||[];notes=n.data||[];photos=m.data||[];
    saveLocal("yp_custom_lessons",customLessons);saveLocal("yp_custom_dishes",customDishes);saveLocal("yp_personal_notes",notes);
    renderLessons();renderDishes();renderNotes();
  }
  async function sendCode(){
    if(!client)return status("Add your Supabase URL and public key to config.js first.",true);
    const email=$("#yp-email")?.value.trim();if(!email)return status("Enter your email address.",true);
    const {error}=await client.auth.signInWithOtp({email,options:{emailRedirectTo:location.origin+location.pathname}});
    status(error?error.message:"Verification code sent. Check your email and enter the code here.",!!error);
  }
  async function verify(){
    if(!client)return status("Cloud is not configured.",true);
    const email=$("#yp-email")?.value.trim(),token=$("#yp-otp")?.value.trim();
    if(!email||!token)return status("Enter your email and the verification code.",true);
    const {data,error}=await client.auth.verifyOtp({email,token,type:"email"});
    if(error)return status(error.message,true);
    user=data.user;status("Signed in as "+user.email+". Loading your private data…");
    try{await loadCloud();status("Signed in. Your personal cloud data is loaded.");}catch(e){status("Signed in, but loading data failed: "+e.message,true);}
  }
  async function signOut(){if(!client)return;const {error}=await client.auth.signOut();user=null;customLessons=[];customDishes=[];notes=[];renderLessons();renderDishes();renderNotes();status(error?error.message:"Signed out. Local device data remains on this phone.",!!error);}
  async function sync(){
    if(!client||!user)return status("Sign in before syncing. Local data has not been uploaded.",true);
    status("Syncing…");
    const local=localSnapshot();
    const {data:remote,error:readError}=await client.from("user_app_backups").select("payload,updated_at").eq("user_id",user.id).maybeSingle();
    if(readError)return status("Could not read cloud backup: "+readError.message,true);
    // Merge completion marks instead of overwriting either device's completed lessons.
    const mergedHours=new Map([...(remote?.payload?.duty_hours||[]),...(local.duty_hours||[])].map(x=>[x.date,x]));
    const merged={...local,progress:{...(remote?.payload?.progress||{}),...(local.progress||{})},
      best_test:Math.max(Number(remote?.payload?.best_test||0),Number(local.best_test||0)),
      duty_hours:[...mergedHours.values()].sort((a,b)=>String(b.date).localeCompare(String(a.date))),
      custom_lessons:local.custom_lessons||[],custom_dishes:local.custom_dishes||[],notes:local.notes||[]};
    localStorage.setItem("ypd",JSON.stringify(merged.progress));localStorage.setItem("ypdh",JSON.stringify(merged.duty_hours));
    if(typeof S!=="undefined"){S.done=merged.progress;}
    const {error}=await client.from("user_app_backups").upsert({user_id:user.id,payload:merged,updated_at:new Date().toISOString()},{onConflict:"user_id"});
    if(error)return status("Sync failed: "+error.message,true);
    status("Server confirmed sync at "+new Date().toLocaleTimeString()+". Progress and duty records merged; personal lists sync in their own tables.");
  }
  async function uploadDishPhotos(dishId){
    if(!client||!user)return status("Sign in before uploading private cloud photos.",true);
    const input=document.createElement("input");input.type="file";input.accept="image/*";input.multiple=true;
    input.onchange=async()=>{const files=[...(input.files||[])];if(!files.length)return;status("Uploading "+files.length+" photo(s)…");
      for(const file of files){
        if(file.size>8*1024*1024){status(file.name+" is over 8 MB. Skipped.",true);continue;}
        const ext=(file.name.split(".").pop()||"jpg").toLowerCase().replace(/[^a-z0-9]/g,"")||"jpg";
        const path=user.id+"/"+dishId+"/"+crypto.randomUUID()+"."+ext;
        const up=await client.storage.from("dish-photos").upload(path,file,{upsert:false,contentType:file.type||"image/jpeg"});
        if(up.error){status("Photo upload failed: "+up.error.message,true);return;}
        const row=await client.from("dish_media").insert({user_id:user.id,dish_id:dishId,storage_path:path,file_name:file.name,content_type:file.type||"image/jpeg"});
        if(row.error){status("Photo record failed: "+row.error.message,true);return;}
      }
      await loadCloud();status("Cloud photos uploaded. They are private to your account.");
    };input.click();
  }
  async function addLesson(){
    const title=$("#yl-title").value.trim(),body=$("#yl-body").value.trim();if(!title||!body)return status("Enter a lesson title and lesson content.",true);
    const row={title,body};
    if(user){const {error}=await client.from("personal_lessons").insert({...row,user_id:user.id});if(error)return status(error.message,true);await loadCloud();}
    else{customLessons=getLocal("yp_custom_lessons");customLessons.unshift({id:crypto.randomUUID(),...row,updated_at:new Date().toISOString()});saveLocal("yp_custom_lessons",customLessons);renderLessons();}
    $("#yl-title").value="";$("#yl-body").value="";status(user?"Personal lesson saved to cloud.":"Saved on this device only. Sign in to sync."); 
  }
  async function addDish(){
    const name=$("#yd-name").value.trim(),category=$("#yd-category").value.trim(),ingredients=$("#yd-ingredients").value.trim(),description=$("#yd-description").value.trim();
    if(!name||!ingredients)return status("Enter the dish name and confirmed ingredients.",true);
    const row={name,category,ingredients,description};
    if(user){const {error}=await client.from("personal_dishes").insert({...row,user_id:user.id});if(error)return status(error.message,true);await loadCloud();}
    else{customDishes=getLocal("yp_custom_dishes");customDishes.unshift({id:crypto.randomUUID(),...row,updated_at:new Date().toISOString()});saveLocal("yp_custom_dishes",customDishes);renderDishes();}
    ["yd-name","yd-category","yd-ingredients","yd-description"].forEach(id=>$("#"+id).value="");status(user?"Personal dish saved to cloud.":"Saved on this device only. Sign in to sync.");
  }
  async function saveNote(){
    const body=$("#yn-text").value.trim();if(!body)return status("Write a note first.",true);
    if(user){const {error}=await client.from("personal_notes").insert({user_id:user.id,body});if(error)return status(error.message,true);await loadCloud();}
    else{notes=getLocal("yp_personal_notes");notes.unshift({id:crypto.randomUUID(),body,created_at:new Date().toISOString()});saveLocal("yp_personal_notes",notes);renderNotes();}
    $("#yn-text").value="";status(user?"Note saved to your cloud account.":"Note saved on this device only.");
  }
  async function editRow(table,id,localKey,arrName){
    const arr=arrName==="lessons"?customLessons:customDishes, item=arr.find(x=>x.id===id);if(!item)return;
    if(arrName==="lessons"){
      const title=prompt("Lesson title",item.title);if(title===null)return;
      const body=prompt("Lesson content",item.body);if(body===null)return;
      if(!title.trim()||!body.trim())return status("Title and content cannot be empty.",true);
      const patch={title:title.trim(),body:body.trim()};
      if(user){const {error}=await client.from(table).update(patch).eq("id",id);if(error)return status(error.message,true);await loadCloud();}
      else{const a=arr.map(x=>x.id===id?{...x,...patch,updated_at:new Date().toISOString()}:x);saveLocal(localKey,a);customLessons=a;renderLessons();}
    }else{
      const name=prompt("Dish name",item.name);if(name===null)return;
      const category=prompt("Category",item.category||"");if(category===null)return;
      const ingredients=prompt("Confirmed ingredients",item.ingredients||"");if(ingredients===null)return;
      const description=prompt("Guest-friendly description",item.description||"");if(description===null)return;
      if(!name.trim()||!ingredients.trim())return status("Dish name and ingredients cannot be empty.",true);
      const patch={name:name.trim(),category,ingredients,description};
      if(user){const {error}=await client.from(table).update(patch).eq("id",id);if(error)return status(error.message,true);await loadCloud();}
      else{const a=arr.map(x=>x.id===id?{...x,...patch,updated_at:new Date().toISOString()}:x);saveLocal(localKey,a);customDishes=a;renderDishes();}
    }
    status("Personal item updated. Original course/menu unchanged.");
  }
  async function removeRow(table,id,localKey,arrName){
    if(!confirm("Delete this personal item?"))return;
    if(user){const {error}=await client.from(table).delete().eq("id",id);if(error)return status(error.message,true);await loadCloud();}
    else{const a=getLocal(localKey).filter(x=>x.id!==id);saveLocal(localKey,a);if(arrName==="lessons")customLessons=a;if(arrName==="dishes")customDishes=a;if(arrName==="notes")notes=a;renderLessons();renderDishes();renderNotes();}
    status("Personal item deleted. Built-in lessons and menu were not changed.");
  }
  function exportData(){download("yasmine-palace-training-backup.json",JSON.stringify(localSnapshot(),null,2));status("Structured data backup downloaded. Photos are not included in this JSON export.");}
  function importData(){
    const inp=document.createElement("input");inp.type="file";inp.accept="application/json";
    inp.onchange=async()=>{const f=inp.files?.[0];if(!f)return;try{
      const x=JSON.parse(await f.text());if(x.app!=="yasmine-palace-trainer"||x.version!==1)throw Error("This is not a supported Yasmine Palace backup.");
      if(!confirm("Restore this backup? Existing progress will be merged. Personal lists will be replaced on this device."))return;
      const old=JSON.parse(localStorage.getItem("ypd")||"{}");localStorage.setItem("ypd",JSON.stringify({...old,...(x.progress||{})}));
      if(x.best_test)localStorage.setItem("ypdb2",String(Math.max(Number(localStorage.getItem("ypdb2")||0),Number(x.best_test))));
      if(Array.isArray(x.duty_hours))localStorage.setItem("ypdh",JSON.stringify(x.duty_hours));
      ["custom_lessons","custom_dishes","notes"].forEach((k)=>{if(Array.isArray(x[k]))localStorage.setItem(k==="notes"?"yp_personal_notes":"yp_"+k,JSON.stringify(x[k]));});
      if(x.theme==="light"||x.theme==="dark")localStorage.setItem("ypdt",x.theme);
      status("Backup restored on this device. Review it, then sign in and sync.");if(typeof go==="function")go("today");
    }catch(e){status("Restore failed: "+e.message,true);}};
    inp.click();
  }
  function bind(){
    $("#yp-back")?.addEventListener("click",()=>{panelOpen=false;go("more");});
    $("#yp-send-code")?.addEventListener("click",sendCode);$("#yp-verify")?.addEventListener("click",verify);$("#yp-signout")?.addEventListener("click",signOut);
    $("#yp-sync")?.addEventListener("click",sync);$("#yp-export")?.addEventListener("click",exportData);$("#yp-import")?.addEventListener("click",importData);
    $("#yl-add")?.addEventListener("click",addLesson);$("#yd-add")?.addEventListener("click",addDish);$("#yn-save")?.addEventListener("click",saveNote);
    $("#yd-search")?.addEventListener("click",()=>{const q=$("#yd-name").value.trim()||"Levantine restaurant dish";$("#yd-photo-search").innerHTML=`Open a licensed-image search and check the usage rights before saving: <a target="_blank" rel="noopener" href="https://commons.wikimedia.org/w/index.php?search=${encodeURIComponent(q)}&title=Special:MediaSearch&type=image">Wikimedia Commons image search</a> · <a target="_blank" rel="noopener" href="https://www.google.com/search?tbm=isch&q=${encodeURIComponent(q)}">Google Images (verify rights yourself)</a>`;});
    $("#yl-list")?.addEventListener("click",e=>{const edit=e.target.closest("[data-edit-lesson]");if(edit){editRow("personal_lessons",edit.dataset.editLesson,"yp_custom_lessons","lessons");return;}const b=e.target.closest("[data-del-lesson]");if(b)removeRow("personal_lessons",b.dataset.delLesson,"yp_custom_lessons","lessons");});
    $("#yd-list")?.addEventListener("click",e=>{const photo=e.target.closest("[data-photo-dish]");if(photo){uploadDishPhotos(photo.dataset.photoDish);return;}const edit=e.target.closest("[data-edit-dish]");if(edit){editRow("personal_dishes",edit.dataset.editDish,"yp_custom_dishes","dishes");return;}const b=e.target.closest("[data-del-dish]");if(b)removeRow("personal_dishes",b.dataset.delDish,"yp_custom_dishes","dishes");});
    $("#yn-list")?.addEventListener("click",e=>{const b=e.target.closest("[data-del-note]");if(b)removeRow("personal_notes",b.dataset.delNote,"yp_personal_notes","notes");});
  }
  function openPanel(){
    const v=$("#v");if(!v)return;panelOpen=true;
    v.innerHTML=panel();head();bind();
    if(!configured){status("Cloud setup required. Follow README.md and run supabase/schema.sql. Local personal content still works.",true);}
    else if(!initClient()){status("Supabase library failed to load. Check your internet connection.",true);}
    else{
      client.auth.getSession().then(async({data,error})=>{
        if(error)return status(error.message,true);
        user=data.session?.user||null;
        if(user){$("#yp-email").value=user.email||"";try{await loadCloud();status("Signed in as "+user.email+".");}catch(e){status("Could not load cloud data: "+e.message,true);}}
        client.auth.onAuthStateChange((_event,session)=>{user=session?.user||null;if(user)loadCloud().catch(e=>status(e.message,true));});
      });
    }
  }
  // Expose a separate panel button without changing the original protected course/menu source.
  const observer=new MutationObserver(()=>{
    if(!panelOpen && $("nav button[data-t=more].on") && !$("#yp-open-cloud")){
      const v=$("#v");if(v){const b=document.createElement("button");b.id="yp-open-cloud";b.className="b";b.textContent="☁️ Account, My Lessons & Cloud";b.style.marginTop="14px";b.onclick=openPanel;v.appendChild(b);}
    }
    if(!$("nav button[data-t=more].on"))panelOpen=false;
  });
  observer.observe(document.documentElement,{childList:true,subtree:true});
  window.YasmineCloud={open:openPanel,exportData,localSnapshot};
})();
