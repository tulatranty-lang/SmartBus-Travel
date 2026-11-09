import {regions} from './state';
export type ImportRow={name:string;provinceCode:string;routeCode?:string;latitude?:number|string;longitude?:number|string;description?:string};
export function parseImport(text:string,type:'tourism-data'|'bus-data'):{items:ImportRow[]}{
 if(new TextEncoder().encode(text).length>2*1024*1024)throw Error('Tệp JSON không được vượt quá 2 MB.');
 let raw:unknown;try{raw=JSON.parse(text)}catch{throw Error('JSON chưa đúng định dạng. Kiểm tra dấu phẩy và dấu ngoặc.');}
 const payload=Array.isArray(raw)?{items:raw}:raw;
 if(!payload||typeof payload!=='object'||Object.keys(payload).some(k=>k!=='items')||!('items'in payload)||!Array.isArray(payload.items)||payload.items.length<1||payload.items.length>200)throw Error('Cần danh sách từ 1 đến 200 bản ghi trong mảng hoặc {"items":[…]}.');
 const keys=new Set<string>();for(const[rowIndex,row]of payload.items.entries()){
 const label=`Bản ghi ${rowIndex+1}: `;
 if(!row||typeof row!=='object'||Array.isArray(row)||typeof row.name!=='string'||row.name.trim().length<2||row.name.length>200)throw Error(label+'tên cần từ 2 đến 200 ký tự.');
 if(typeof row.provinceCode!=='string'||!regions[row.provinceCode.toUpperCase()])throw Error(label+'mã khu vực không hợp lệ.');
 if(row.description!==undefined&&typeof row.description!=='string')throw Error(label+'mô tả phải là chuỗi.');
 const key=type==='bus-data'?String(row.routeCode||'').toLowerCase():row.name.trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').toLowerCase();
 if(type==='bus-data'&&(typeof row.routeCode!=='string'||!/^[A-Za-z0-9_-]{1,50}$/.test(row.routeCode)))throw Error(label+'routeCode chỉ gồm chữ, số, gạch ngang và gạch dưới, tối đa 50 ký tự.');
 if(keys.has(key))throw Error(label+'tên hoặc mã trùng trong tệp.');keys.add(key);
 if(type==='tourism-data'&&(row.latitude==null||row.longitude==null||row.latitude===''||row.longitude===''||!Number.isFinite(Number(row.latitude))||Number(row.latitude)<8||Number(row.latitude)>24||!Number.isFinite(Number(row.longitude))||Number(row.longitude)<102||Number(row.longitude)>110))throw Error(label+'cần tọa độ Việt Nam hợp lệ (vĩ độ 8–24, kinh độ 102–110).');
 }return payload as {items:ImportRow[]};
}
