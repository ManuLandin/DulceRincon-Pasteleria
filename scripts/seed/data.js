export const SEED_KEY='pasteleria-demo-v1';
export const SEED_ACTION='seedDesarrollo';
export const DEMO='[DEMO v1] ';

export function assertSeedEnvironment(config,env){
 const database=config?.database;
 if(!['development','test'].includes(env.NODE_ENV)||config.production)throw new Error('Seeder bloqueado: NODE_ENV debe ser development o test explícitamente.');
 if(!['127.0.0.1','localhost','::1'].includes(database?.host))throw new Error('Seeder bloqueado: solo MySQL local de desarrollo/pruebas.');
 if(!/^(?:[a-zA-Z][a-zA-Z0-9_]{0,53}_(?:dev|test)|dulcerincon_test_\d+_\d+)$/.test(database?.database||'')||env.SEED_CONFIRM_DB!==database.database)throw new Error('Seeder bloqueado: usa una BD dedicada _dev/_test y confirma su nombre exacto en SEED_CONFIRM_DB. pasteleria_db no está permitida.');
 return database.database;
}
export function mexicoToday(){return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Mexico_City',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
const dateOf=date=>date.toISOString().slice(0,10)+' 12:00:00';
const addDays=(day,days)=>{const result=new Date(day.slice(0,10)+'T12:00:00Z');result.setUTCDate(result.getUTCDate()+days);return dateOf(result);};
export function buildDataset(anchor=mexicoToday()){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(anchor)||!Number.isFinite(Date.parse(anchor))||new Date(anchor).toISOString().slice(0,10)!==anchor)throw new Error('Fecha de referencia inválida.');
 const end=new Date(anchor+'T12:00:00Z'),start=new Date(end);start.setUTCDate(1);start.setUTCMonth(start.getUTCMonth()-3);const maxDay=new Date(Date.UTC(start.getUTCFullYear(),start.getUTCMonth()+1,0)).getUTCDate();start.setUTCDate(Math.min(end.getUTCDate(),maxDay));
 const days=Math.floor((end-start)/86400000);
 const dates=Array.from({length:20},(_,i)=>dateOf(new Date(start.getTime()+Math.floor(2+i*(days-4)/19)*86400000)));
 const users=[['ana','Ana','Administrador'],['emiliano','Emiliano','Trabajador'],['marco','Marco','Trabajador'],['sofia','Sofía','Trabajador'],['juan.carlos','Juan Carlos','Cliente'],['diego','Diego','Cliente'],['valeria','Valeria','Cliente'],['mariana','Mariana','Cliente'],['luis','Luis','Cliente']].map(([key,name,role])=>({name,role,email:key+'.seed-v1@example.test'}));
 const ingredients=[['Harina de trigo','kg'],['Azúcar refinada','kg'],['Huevo','pieza'],['Leche entera','litro'],['Mantequilla','kg'],['Cacao','kg'],['Fresa','kg'],['Vainilla','litro'],['Zanahoria','kg'],['Queso crema','kg'],['Crema para batir','litro'],['Chocolate','kg'],['Galleta molida','kg'],['Nuez','kg'],['Café','kg']].map(([name,unit],i)=>({name:DEMO+name,unit,opening:unit==='pieza'?600000:60000+i*1000,minimum:unit==='pieza'?60000:5000}));
 const cakes=[['Chocolate clásico',42000,5],['Tres leches tradicional',45000,3],['Fresa con crema',48000,6],['Vainilla de la casa',38000,7],['Zanahoria y nuez',52000,8],['Red velvet',58000,5],['Cheesecake natural',56000,9],['Chocolate trufado',62000,11],['Moca',54000,14],['Nuez caramelizada',57000,13],['Cheesecake de fresa',60000,6],['Tres leches con durazno',51000,3],['Chocolate individual',9500,5],['Tres leches individual',9000,3],['Fresa individual',9500,6],['Vainilla familiar',65000,7],['Zanahoria familiar',82000,8],['Red velvet familiar',89000,5],['Cheesecake de chocolate',64000,11],['Chocolate y café',59000,14],['Nuez y vainilla',55000,13],['Fresa y chocolate',61000,6],['Pastel de galleta y crema',53000,12],['Tres leches familiar',78000,3],['Chocolate celebración',115000,11]];
 const products=cakes.map(([name,price,flavor],i)=>({name:DEMO+'Pastel '+name,description:'Pastel artesanal de demostración. '+(name.includes('individual')?'Porción individual.':name.includes('familiar')?'Presentación familiar, 20 porciones.':'Presentación de 10 a 12 porciones.')+' Fotografía ilustrativa.',price,opening:12+i%5,flavor}));
 const linesFor=i=>[0,1].map((offset)=>{const product=(i*2+offset)%25;return {product,quantity:offset+1,price:products[product].price};});
 const totalOf=lines=>lines.reduce((n,line)=>n+line.price*line.quantity,0);
 const orders=Array.from({length:15},(_,i)=>{const lines=linesFor(i),delivered=i>=10;return {key:i,state:i<5?'Pendiente':i<10?'En progreso':'Despachado',client:4+i%5,worker:1+i%3,lines,total:totalOf(lines),date:delivered?addDays(dates[i-10],-1):addDays(anchor,-4+(i%2)),pickup:delivered?dates[i-10]:addDays(anchor,1+i%3)};});
 const sales=Array.from({length:20},(_,i)=>{const order=i<5?orders[10+i]:null,lines=order?order.lines:linesFor(i);return {key:i,order:order?.key??null,client:order?.client??(i%3===0?null:4+i%5),worker:order?.worker??1+i%3,lines,total:totalOf(lines),date:dates[i]};});
 const suppliers=['Molinos del Obrador','Lácteos de Prueba','Frutas del Horno','Cacao y Vainilla','Insumos Dulces'].map((name,i)=>({name:DEMO+name,email:'proveedor'+(i+1)+'.seed-v1@example.test',phone:'0000000000',address:'Domicilio ficticio de pruebas '+(i+1)}));
 return {anchor,users,ingredients,products,orders,sales,suppliers};
}
