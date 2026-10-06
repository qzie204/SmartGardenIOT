/* DEMO ADAPTER. Thay lớp này bằng API của backend khi dùng dữ liệu thật.
   Không có kết nối MQTT, email hoặc xác thực phía máy chủ trong bản này.
   Tài khoản đăng ký được lưu cục bộ, mật khẩu băm PBKDF2; đây vẫn là prototype.
   SG.on/emit giữ giao diện tách khỏi cách lấy dữ liệu. */
(function () {
  const listeners = {};
  SG.on = (event, callback) => (listeners[event] ||= []).push(callback);
  SG.emit = (event, payload) => (listeners[event] || []).forEach(fn => fn(payload));
  const now = Date.now();
  const S = SG.state = {ready:false, online:true, updated:now, readings:[], commands:[], user:null, nextResult:'success', dev:{light:{on:true,pending:false},pump:{on:false,pending:false}}};
  let readingID = 0, commandID = 0;
  function batch(ts) {
    const t = ts / 1000;
    const values = {temperature:+(27.2 + 1.8 * Math.sin(t / 58) + .3 * Math.cos(t / 13)).toFixed(1), humidity:Math.round(66 + 6 * Math.cos(t / 90) + Math.sin(t / 17)), light:Math.round(780 + 220 * Math.sin(t / 110) + 25 * Math.cos(t / 21))};
    return SG.TYPES.map(type => ({id:++readingID,type,value:values[type],ts}));
  }
  for (let i = 59; i >= 0; i--) S.readings.push(...batch(now - i * 5000));
  S.readings.reverse();
  const seed = [
    ['light','off','success',18], ['pump','on','failed',14], ['pump','on','success',10],
    ['light','off','timeout',7], ['light','on','success',4], ['pump','off','success',1]
  ];
  S.commands = seed.map(([device,action,result,minutes]) => ({id:++commandID,device,action,result,user:'demo',sentAt:now-minutes*60000,respondedAt:result==='timeout'?null:now-minutes*60000+900,reason:result==='failed'?'Thiết bị mô phỏng từ chối lệnh.':result==='timeout'?'Không có phản hồi trong thời gian chờ mô phỏng.':null})).reverse();
  function refresh() {
    if (!S.online) return;
    const ts = Date.now();
    S.readings = [...batch(ts).reverse(), ...S.readings].slice(0,600);
    S.updated = ts;
    SG.emit('data');
  }
  setTimeout(() => { S.ready = true; SG.emit('data'); }, 350);
  setInterval(() => { if (S.user) refresh(); }, 5000);
  const ACCOUNT_KEY = 'sg_accounts_v1';
  function accounts() {
    try { const list=JSON.parse(SG.storage.get(ACCOUNT_KEY)||'[]');return Array.isArray(list)?list:[]; } catch (_) { return []; }
  }
  const pause = ms => new Promise(resolve=>setTimeout(resolve,ms));
  async function passwordHash(password,salt) {
    if(!window.crypto?.subtle)throw new Error('Trình duyệt chưa hỗ trợ đăng ký cục bộ. Hãy mở bằng Chrome hoặc Edge.');
    const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);
    const bytes=Uint8Array.from(salt.match(/.{2}/g),byte=>parseInt(byte,16));
    const result=await crypto.subtle.deriveBits({name:'PBKDF2',salt:bytes,iterations:100000,hash:'SHA-256'},key,256);
    return Array.from(new Uint8Array(result),byte=>byte.toString(16).padStart(2,'0')).join('');
  }
  SG.api = {
    async login(username,password) {
      const key=username.trim().toLowerCase();await pause(350);
      if(key==='demo'&&password==='demo123')return {username:'demo'};
      const account=accounts().find(a=>a.username===key);
      if(account&&await passwordHash(password,account.salt)===account.hash)return {username:key};
      throw new Error('Tài khoản hoặc mật khẩu chưa đúng. Vui lòng thử lại.');
    },
    async register({name,email,username,password,confirm}) {
      name=name.trim();email=email.trim().toLowerCase();username=username.trim().toLowerCase();
      if(!name||!email||!username||!password||!confirm)throw new Error('Vui lòng điền đầy đủ thông tin đăng ký.');
      if(name.length>80)throw new Error('Họ và tên tối đa 80 ký tự.');
      if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new Error('Email chưa đúng định dạng.');
      if(!/^[a-z0-9_.-]{3,30}$/.test(username))throw new Error('Tài khoản gồm 3–30 chữ cái không dấu, chữ số, dấu chấm, gạch dưới hoặc gạch ngang.');
      if(password.length<8||password.length>128)throw new Error('Mật khẩu cần từ 8 đến 128 ký tự.');
      if(password!==confirm)throw new Error('Mật khẩu nhập lại chưa khớp.');
      const duplicate=list=>username==='demo'||list.some(a=>a.username===username||a.email===email);
      if(duplicate(accounts()))throw new Error('Tài khoản hoặc email này đã được đăng ký.');
      const salt=Array.from(crypto.getRandomValues(new Uint8Array(16)),byte=>byte.toString(16).padStart(2,'0')).join('');
      const hash=await passwordHash(password,salt),list=accounts();
      if(duplicate(list))throw new Error('Tài khoản hoặc email này đã được đăng ký.');
      list.push({username,name,email,salt,hash});
      if(!SG.storage.set(ACCOUNT_KEY,JSON.stringify(list)))throw new Error('Không thể lưu tài khoản. Hãy cho phép trình duyệt lưu dữ liệu rồi thử lại.');
      return {username};
    },
    hasUser(username) { return username==='demo'||accounts().some(a=>a.username===username); },
    userInfo(username) { const a=accounts().find(a=>a.username===username);return a?{name:a.name,email:a.email}:{name:'',email:''}; },
    forgot() { return new Promise(resolve => setTimeout(() => resolve({simulated:true}),500)); },
    refresh,
    setOnline(online) {
      S.online = Boolean(online);
      if (!S.online) S.commands.filter(c=>c.result==='pending').forEach(c=>c.interrupted=true);
      if (S.online) refresh(); else SG.emit('data');
      SG.emit('cmd');
    },
    setNextResult(result) { if (['success','failed','timeout'].includes(result)) S.nextResult = result; },
    send(device) {
      if (!S.user || !S.online || !S.dev[device] || S.dev[device].pending) return false;
      const state = S.dev[device], outcome = S.nextResult;
      S.nextResult = 'success';
      const command = {id:++commandID,device,action:state.on?'off':'on',result:'pending',user:S.user,sentAt:Date.now(),respondedAt:null,reason:null};
      S.commands.unshift(command);
      state.pending = true;
      SG.emit('cmd');
      setTimeout(() => {
        command.result = command.interrupted || !S.online ? 'timeout' : outcome;
        command.respondedAt = command.result==='timeout' ? null : Date.now();
        command.reason = command.result==='failed'?'Thiết bị mô phỏng từ chối lệnh.':command.result==='timeout'?'Không nhận được phản hồi trong thời gian chờ mô phỏng.':null;
        state.pending = false;
        // Chỉ đổi trạng thái sau phản hồi thành công, không bật/tắt lạc quan.
        if (command.result==='success') state.on = command.action==='on';
        SG.emit('cmd'); SG.emit('complete',command);
      }, outcome==='timeout'?3000:1100);
      return true;
    }
  };
})();
