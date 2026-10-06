(function () {
  const $ = SG.$;
  function togglePassword(button,input,label='mật khẩu') {
    const visible=input.type==='password';input.type=visible?'text':'password';
    button.innerHTML=SG.ic(visible?'ph-eye-slash':'ph-eye');
    button.setAttribute('aria-label',(visible?'Ẩn ':'Hiện ')+label);button.setAttribute('aria-pressed',String(visible));
  }
  $('#lt').onclick=()=>togglePassword($('#lt'),$('#lp'));
  document.querySelectorAll('[data-password]').forEach(b=>b.onclick=()=>togglePassword(b,document.getElementById(b.dataset.password),b.dataset.password==='rc'?'mật khẩu nhập lại':'mật khẩu'));
  function showAuth(id) {
    ['lf','rf','ff'].forEach(key=>$('#'+key).classList.toggle('hide',id!==key));
    $('#auth-success').hidden=true;$('#le').textContent='';$('#r-error').textContent='';$('#fr').textContent='';$('#fm').hidden=true;
    ({lf:$('#lu'),rf:$('#rn'),ff:$('#fe')})[id].focus();
  }
  $('#open-register').onclick=()=>showAuth('rf');$('#register-back').onclick=()=>showAuth('lf');
  $('#rf').onsubmit=async event=>{
    event.preventDefault();if($('#r-submit').disabled)return;
    $('#r-error').textContent='';$('#r-submit').disabled=true;$('#r-submit').innerHTML=SG.ic('ph-spinner spin')+' Đang tạo tài khoản…';
    try {
      const result=await SG.api.register({name:$('#rn').value,email:$('#re').value,username:$('#ru').value,password:$('#rp').value,confirm:$('#rc').value});
      $('#rf').reset();showAuth('lf');$('#lu').value=result.username;$('#lp').value='';
      $('#auth-success').textContent='Đăng ký thành công. Bạn có thể đăng nhập bằng tài khoản vừa tạo.';$('#auth-success').hidden=false;$('#lp').focus();
    } catch(error){$('#r-error').textContent=error.message;}
    finally{$('#r-submit').disabled=false;$('#r-submit').innerHTML='Đăng ký '+SG.ic('ph-arrow-right');}
  };
  $('#lf').onsubmit = async event => {
    event.preventDefault();
    if ($('#lb').disabled) return;
    const username = $('#lu').value.trim(), password = $('#lp').value;
    if (!username || !password) { $('#le').textContent='Vui lòng nhập tài khoản và mật khẩu.'; (!username?$('#lu'):$('#lp')).focus(); return; }
    $('#le').textContent=''; $('#lb').disabled=true; $('#lb').innerHTML=SG.ic('ph-spinner spin')+' Đang đăng nhập…';
    try {
      const result = await SG.api.login(username,password);
      SG.storage.remove('sg_user'); SG.storage.remove('sg_user','sessionStorage');
      SG.storage.set('sg_user', result.username, $('#lr').checked?'localStorage':'sessionStorage');
      SG.start(result.username);
    } catch (error) { $('#le').textContent=error.message; $('#lp').focus(); }
    finally { $('#lb').disabled=false; $('#lb').innerHTML='Đăng nhập '+SG.ic('ph-arrow-right'); }
  };
  $('#lf-forgot').onclick=()=>showAuth('ff');
  $('#fback').onclick=()=>showAuth('lf');
  $('#ff').onsubmit = async event => {
    event.preventDefault(); if ($('#fb').disabled) return;
    const value = $('#fe').value.trim();
    if (!value) { $('#fr').textContent='Vui lòng nhập tài khoản hoặc email.'; return; }
    if (value.includes('@') && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) { $('#fr').textContent='Email chưa đúng định dạng.'; return; }
    $('#fr').textContent=''; $('#fm').hidden=true; $('#fb').disabled=true; $('#fb').textContent='Đang xử lý…';
    try { await SG.api.forgot(value); $('#fm').hidden=false; $('#fm').textContent='Đã hoàn tất thử nghiệm. Bản demo không gửi email. Bạn có thể đăng nhập bằng demo / demo123.'; }
    catch (_) { $('#fr').textContent='Chưa thể xử lý. Vui lòng thử lại.'; }
    finally { $('#fb').disabled=false; $('#fb').textContent='Thử yêu cầu khôi phục'; }
  };
  $('#logout').onclick = () => { SG.storage.remove('sg_user'); SG.storage.remove('sg_user','sessionStorage'); location.reload(); };
})();
