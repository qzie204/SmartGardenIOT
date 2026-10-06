/* Tiện ích không phụ thuộc thư viện hoặc kết nối mạng. */
SG.$ = selector => document.querySelector(selector);
SG.ic = name => `<i class="ph ${name}" aria-hidden="true"></i>`;
SG.esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
SG.norm = value => String(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');
SG.act = action => action === 'on' ? 'Bật' : 'Tắt';
SG.val = reading => `${Number(reading.value).toFixed(SG.META[reading.type].d)} ${SG.META[reading.type].u}`;
SG.fmt = timestamp => {
  const parts = {};
  new Intl.DateTimeFormat('en-GB', {timeZone:'Asia/Ho_Chi_Minh', day:'2-digit', month:'2-digit', year:'2-digit', hour:'2-digit', minute:'2-digit', second:'2-digit', hourCycle:'h23'}).formatToParts(timestamp).forEach(p => parts[p.type] = p.value);
  return `${parts.day}/${parts.month}/${parts.year} ${parts.hour}:${parts.minute}:${parts.second}`;
};
SG.fmtT = timestamp => SG.fmt(timestamp).slice(9);
SG.matchTime = (query, timestamp) => {
  const digits=query.replace(/\D/g,'');if(!digits)return false;
  const short=SG.fmt(timestamp);
  const year=new Intl.DateTimeFormat('en',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric'}).format(timestamp);
  const full=short.slice(0,6)+year+short.slice(8);
  return [short,full].some(value=>value.replace(/\D/g,'').includes(digits));
};
/* Một số chế độ riêng tư chặn storage ở file://. Ứng dụng vẫn chạy trong phiên. */
SG.storage = {
  get(key, kind = 'localStorage') { try { return window[kind].getItem(key); } catch (_) { return null; } },
  set(key, value, kind = 'localStorage') { try { window[kind].setItem(key, value); return true; } catch (_) { return false; } },
  remove(key, kind = 'localStorage') { try { window[kind].removeItem(key); } catch (_) {} }
};
SG.safeURL = value => { try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) ? url.href : ''; } catch (_) { return ''; } };
