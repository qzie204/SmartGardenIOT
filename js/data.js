(function(){
  const $=SG.$,D={by:'time',q:'',asc:false,page:1,size:10};
  const hints={time:'dd/MM/yy HH:mm:ss',temperature:'Nhập nhiệt độ, ví dụ 27',humidity:'Nhập độ ẩm, ví dụ 66',light:'Nhập ánh sáng, ví dụ 780'};
  // Số nhập khớp một phần của giá trị, giống bài mẫu.
  function numberMatches(r,q){
    q=q.trim().replace(',','.');
    if(!q)return true;
    if(!/^\d*\.?\d*$/.test(q))return false;
    return Number(r.value).toFixed(SG.META[r.type].d).includes(q);
  }
  function filtered(){
    const q=D.q.trim();
    const rows=SG.state.readings.filter(r=>D.by==='time'?(!q||SG.matchTime(q,r.ts)):(r.type===D.by&&numberMatches(r,q)));
    return D.asc?rows.reverse():rows;
  }
  function render(){
    const rows=filtered();
    $('#d-time-head').setAttribute('aria-sort',D.asc?'ascending':'descending');
    $('#d-sort').innerHTML='Thời gian ghi nhận '+SG.ic(D.asc?'ph-arrow-up':'ph-arrow-down');
    $('#data-count').textContent=SG.state.ready?`${rows.length} bản ghi · Cập nhật tự động mỗi 5 giây`:'Đang chuẩn bị dữ liệu…';
    SG.pager('#d-pg',D,SG.state.ready?rows.length:0,render);
    $('#d-body').innerHTML=!SG.state.ready?`<tr><td colspan="4" class="none">${SG.empty('Đang tải dữ liệu…','Các bản ghi sẽ xuất hiện trong giây lát.')}</td></tr>`:!rows.length?`<tr><td colspan="4" class="none">${SG.empty()}</td></tr>`:rows.slice((D.page-1)*D.size,D.page*D.size).map(r=>`<tr><td class="record-id">#${String(r.id).padStart(4,'0')}</td><td><span class="sensor-label" data-sensor="${r.type}"><span class="sensor-icon">${SG.ic(SG.META[r.type].icon)}</span>${SG.META[r.type].l}</span></td><td class="num">${SG.val(r)}</td><td><time datetime="${new Date(r.ts).toISOString()}">${SG.fmt(r.ts)}</time></td></tr>`).join('');
  }
  // Lọc ngay khi gõ hoặc khi đổi ô chọn, không cần bấm nút.
  function apply(){D.by=$('#d-by').value;D.q=$('#d-q').value;D.page=1;render();}
  $('#d-by').onchange=e=>{$('#d-q').placeholder=hints[e.target.value];apply();};
  $('#d-q').oninput=apply;
  $('#d-form').onsubmit=e=>e.preventDefault();
  $('#d-cl').onclick=()=>{$('#d-form').reset();$('#d-q').placeholder=hints.time;Object.assign(D,{by:'time',q:'',page:1});render();};
  $('#d-sort').onclick=()=>{D.asc=!D.asc;D.page=1;render();};
  SG.renderData=render;SG.on('data',()=>{if(SG.state.user&&SG.currentPage==='data')render();});
})();
