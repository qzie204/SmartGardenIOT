(function(){
  const $=SG.$;
  const fields=[['name','Họ và tên','text'],['studentId','Mã sinh viên','text'],['className','Lớp','text'],['email','Email','email'],['github','Liên kết GitHub','url'],['figma','Liên kết Figma','url'],['postman','Liên kết Postman','url'],['report','Liên kết báo cáo PDF','url']];
  const defaults={...SG.PROFILE,avatar:''};
  const validAvatar=value=>typeof value==='string'&&value.length<500000&&/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(value);
  const profileKey=()=> 'sg_profile_v3:'+SG.state.user;
  SG.loadProfile=username=>{
    Object.assign(SG.PROFILE,defaults,SG.api.userInfo(username));
    try {
      const stored=SG.storage.get('sg_profile_v3:'+username)||(username==='demo'?SG.storage.get('sg_profile_v2'):null);
      const saved=JSON.parse(stored||'null');
      if(saved&&typeof saved==='object'){
        fields.forEach(([key])=>{if(typeof saved[key]==='string')SG.PROFILE[key]=saved[key];});
        if(validAvatar(saved.avatar))SG.PROFILE.avatar=saved.avatar;
      }
    } catch(_){}
  };
  function initial(){return (SG.PROFILE.name.trim().split(/\s+/).at(-1)||SG.state.user||'U').charAt(0).toUpperCase();}
  function avatar(){return validAvatar(SG.PROFILE.avatar)?`<img src="${SG.PROFILE.avatar}" alt="Ảnh đại diện">`:SG.esc(initial());}
  function save(next){
    const profile={...SG.PROFILE,...next};
    if(!SG.storage.set(profileKey(),JSON.stringify(profile)))throw new Error('Không thể lưu hồ sơ. Hãy cho phép trình duyệt lưu dữ liệu rồi thử lại.');
    Object.assign(SG.PROFILE,profile);render();SG.updateIdentity();
  }
  SG.updateIdentity=()=>{
    $('#side-name').textContent=SG.PROFILE.name||SG.state.user||'Tài khoản';
    $('#side-avatar').innerHTML=avatar();$('#profile-shortcut').innerHTML=avatar();
  };
  async function upload(file){
    if(!file)return;
    const error=$('#avatar-error');error.textContent='';
    if(!['image/jpeg','image/png','image/webp'].includes(file.type)){error.textContent='Chọn ảnh JPG, PNG hoặc WebP.';return;}
    if(file.size>5*1024*1024){error.textContent='Ảnh tối đa 5 MB. Vui lòng chọn ảnh nhỏ hơn.';return;}
    const button=$('#upload-avatar');button.disabled=true;button.innerHTML=SG.ic('ph-spinner spin')+' Đang xử lý ảnh…';
    const url=URL.createObjectURL(file);
    try{
      const image=await new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('Không đọc được ảnh. Vui lòng thử file khác.'));img.src=url;});
      if(!image.naturalWidth||!image.naturalHeight)throw new Error('Ảnh không hợp lệ.');
      // Cắt giữa ảnh và thu nhỏ trước khi lưu; không đưa ảnh lên máy chủ.
      const canvas=document.createElement('canvas');canvas.width=canvas.height=384;
      const context=canvas.getContext('2d'),side=Math.min(image.naturalWidth,image.naturalHeight);
      context.fillStyle='#ffffff';context.fillRect(0,0,384,384);
      context.drawImage(image,(image.naturalWidth-side)/2,(image.naturalHeight-side)/2,side,side,0,0,384,384);
      save({avatar:canvas.toDataURL('image/jpeg',.86)});SG.toast('Đã cập nhật ảnh đại diện.');
    }catch(err){$('#avatar-error').textContent=err.message;}
    finally{URL.revokeObjectURL(url);const current=$('#upload-avatar');if(current){current.disabled=false;current.innerHTML=SG.ic('ph-upload-simple')+' '+(SG.PROFILE.avatar?'Đổi ảnh':'Thêm ảnh');}}
  }
  function edit(){
    const dialog=SG.dialog('Chỉnh sửa hồ sơ',`<form id="profile-form"><div class="form-grid">${fields.map(([key,label,type])=>`<label class="field ${type==='url'?'full':''}">${label}<input name="${key}" type="${type}" value="${SG.esc(SG.PROFILE[key])}" maxlength="${type==='url'?500:120}" placeholder="${type==='url'?'https://…':'Chưa cập nhật'}" ${key==='name'?'autocomplete="name"':key==='email'?'autocomplete="email"':''}></label>`).join('')}</div><p class="err" id="profile-error" role="alert"></p><div class="dialog-actions"><button type="button" class="btn" data-close>Hủy</button><button type="submit" class="btn primary">Lưu thay đổi</button></div></form>`);
    dialog.querySelector('form').onsubmit=event=>{
      event.preventDefault();const data=new FormData(event.target),next={};
      for(const [key,label,type] of fields){const value=String(data.get(key)||'').trim();if(type==='url'&&value&&!SG.safeURL(value)){$('#profile-error').textContent=label+' phải bắt đầu bằng http:// hoặc https://.';return;}next[key]=value;}
      try{save(next);dialog.close();SG.toast('Đã lưu thay đổi hồ sơ.');}catch(error){$('#profile-error').textContent=error.message;}
    };
  }
  function render(){
    const profile=SG.PROFILE;
    $('#prof').innerHTML=`<div class="avatar-editor"><span class="avatar profile-avatar">${avatar()}</span><button class="avatar-camera" id="avatar-camera" aria-label="Chọn ảnh đại diện">${SG.ic('ph-camera')}</button></div><div class="avatar-actions"><button class="text-btn" id="upload-avatar">${SG.ic('ph-upload-simple')} ${profile.avatar?'Đổi ảnh':'Thêm ảnh'}</button>${profile.avatar?'<button class="text-btn muted" id="remove-avatar">Xóa ảnh</button>':''}</div><input type="file" id="avatar-file" accept="image/jpeg,image/png,image/webp" hidden><p class="avatar-hint">JPG, PNG, WebP · Tối đa 5 MB</p><p class="err" id="avatar-error" role="alert"></p><h2>${SG.esc(profile.name||'Hồ sơ của bạn')}</h2><p class="profile-user">@${SG.esc(SG.state.user||'')}</p><dl>${[['Mã sinh viên',profile.studentId],['Lớp',profile.className],['Email',profile.email]].map(([label,value])=>`<div><dt>${label}</dt><dd>${SG.esc(value||'Chưa cập nhật')}</dd></div>`).join('')}</dl><button class="btn" id="edit-profile">${SG.ic('ph-pencil-simple')} Chỉnh sửa hồ sơ</button><button class="text-btn" id="clear-profile" style="margin-top:14px">Xóa thông tin đã lưu</button>`;
    const resources=[['ph-github-logo','GitHub','Mã nguồn dự án',profile.github],['ph-figma-logo','Figma','Thiết kế giao diện',profile.figma],['ph-package','Postman','Tài liệu và bộ thử API',profile.postman],['ph-file-pdf','Báo cáo PDF','Tài liệu dự án',profile.report]];
    $('#links').innerHTML=resources.map(([icon,title,description,url])=>{
      const safe=SG.safeURL(url),tag=safe?'a':'div',attrs=safe?`href="${SG.esc(safe)}" target="_blank" rel="noopener noreferrer" aria-label="Mở ${title} trong tab mới"`:'';
      return `<${tag} class="resource-link" ${attrs}><div class="resource-link-top">${SG.ic(icon)}${SG.ic(safe?'ph-arrow-up-right':'ph-minus')}</div><b>${title}</b><p>${description}</p>${safe?'':'<p>Chưa thêm liên kết</p>'}</${tag}>`;
    }).join('');
    $('#avatar-camera').onclick=$('#upload-avatar').onclick=()=>$('#avatar-file').click();
    $('#avatar-file').onchange=event=>{const file=event.target.files[0];event.target.value='';upload(file);};
    if($('#remove-avatar'))$('#remove-avatar').onclick=()=>{try{save({avatar:''});SG.toast('Đã xóa ảnh đại diện.');}catch(error){$('#avatar-error').textContent=error.message;}};
    $('#edit-profile').onclick=edit;
    $('#clear-profile').onclick=()=>{
      SG.dialog('Xóa thông tin hồ sơ?',`<p>Ảnh đại diện, tên, mã sinh viên, lớp, email và các liên kết đã lưu của tài khoản này sẽ được xóa.</p><p class="err" id="clear-error" role="alert"></p><div class="dialog-actions"><button class="btn" data-close>Giữ lại</button><button class="btn primary" id="confirm-clear">Xóa thông tin</button></div>`);
      $('#confirm-clear').onclick=()=>{try{save(defaults);$('#dlg').close();SG.toast('Đã xóa thông tin hồ sơ đã lưu.');}catch(error){$('#clear-error').textContent=error.message;}};
    };
  }
  SG.renderProfile=render;
})();
