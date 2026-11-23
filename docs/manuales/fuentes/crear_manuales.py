from pathlib import Path
import json, re
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.enum.text import WD_ALIGN_PARAGRAPH

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / 'docs' / 'manuales'
SRC = Path(__file__).parent
ROSE = '9D4565'
INK = '262126'

def shade(element, color):
    prop = element.get_or_add_tcPr() if element.tag == qn('w:tc') else element.get_or_add_rPr()
    node = OxmlElement('w:shd'); node.set(qn('w:fill'), color); prop.append(node)

def runs(p, text):
    for piece in re.split(r'(\[(?:COMPLETAR|INSERTAR)[^\]]*\])', text):
        if not piece: continue
        run = p.add_run(piece)
        if piece.startswith(('[COMPLETAR', '[INSERTAR')):
            run.bold = True; run.font.color.rgb = RGBColor.from_string(ROSE)
            shade(run._r, 'FCECF2')

def para(doc, text, style=None):
    p = doc.add_paragraph(style=style)
    runs(p, text)
    return p

def table(doc, rows, widths=None, compact=False):
    t = doc.add_table(rows=1, cols=len(rows[0])); t.autofit = False
    if widths is None:
        widths = [2.0,4.65] if len(rows[0])==2 else [1.5,2.55,2.6]
    for i,w in enumerate(widths): t.columns[i].width=Inches(w)
    for idx,row in enumerate(rows):
        cells = t.rows[0].cells if idx==0 else t.add_row().cells
        trpr = cells[0]._tc.getparent().get_or_add_trPr()
        no_split=OxmlElement('w:cantSplit'); trpr.append(no_split)
        if idx==0:
            repeat=OxmlElement('w:tblHeader'); trpr.append(repeat)
        for c,value,w in zip(cells,row,widths):
            c.width=Inches(w); p=c.paragraphs[0]; p.paragraph_format.space_after=Pt(3)
            p.paragraph_format.space_before=Pt(2); p.paragraph_format.line_spacing=1.02
            if compact:
                p.paragraph_format.keep_with_next=idx<len(rows)-1
            runs(p,str(value))
            for r in p.runs:
                r.font.size=Pt(8.5 if compact else 9.5)
                if idx==0: r.bold=True; r.font.color.rgb=RGBColor.from_string(INK)
            shade(c._tc, 'F5DDE6' if idx==0 else ('FCF7F9' if idx%2 else 'FFFFFF'))
    doc.add_paragraph().paragraph_format.space_after=Pt(1)
    return t

def base(label):
    d=Document(); s=d.sections[0]
    s.page_width=Inches(8.2677); s.page_height=Inches(11.6929)
    s.top_margin=Inches(.72); s.bottom_margin=Inches(.70)
    s.left_margin=s.right_margin=Inches(.80)
    s.header_distance=Inches(.27); s.footer_distance=Inches(.30)
    normal=d.styles['Normal']; normal.font.name='Arial'; normal.font.size=Pt(10.5)
    normal.font.color.rgb=RGBColor.from_string(INK)
    normal.paragraph_format.line_spacing=1.10
    normal.paragraph_format.space_after=Pt(6)
    for key,size,color in [('Title',29,'000000'),('Heading 1',20,ROSE),('Heading 2',13,ROSE)]:
        st=d.styles[key]; st.font.name='Arial';st.font.size=Pt(size);st.font.bold=key!='Title';st.font.color.rgb=RGBColor.from_string(color)
        st.paragraph_format.space_before=Pt(10 if key=='Heading 2' else 0)
        st.paragraph_format.space_after=Pt(9)
        st.paragraph_format.keep_with_next=True
    # El título no contiene bordes ni líneas decorativas.
    for stname in ['Title','Normal','Heading 1','Heading 2']:
        pr=d.styles[stname]._element.find(qn('w:pPr'))
        if pr is not None:
            for border in list(pr.findall(qn('w:pBdr'))):pr.remove(border)
    hp=s.header.paragraphs[0];hp.text='DULCE RINCÓN  |  '+label.upper()
    for r in hp.runs:r.font.name='Arial';r.font.size=Pt(8);r.font.color.rgb=RGBColor.from_string(ROSE)
    fp=s.footer.paragraphs[0];fp.alignment=WD_ALIGN_PARAGRAPH.RIGHT
    fp.add_run('Versión 1.0 · 16 nov 2026   |   ')
    fld=OxmlElement('w:fldSimple');fld.set(qn('w:instr'),'PAGE');fp._p.append(fld)
    for r in fp.runs:r.font.size=Pt(8)
    d.core_properties.author='Equipo del proyecto Dulce Rincón'
    d.core_properties.subject='Documentación del sistema de pastelería'
    return d

def dictionary(doc):
    schema=json.loads((ROOT/'docs/database/schema-inspected.json').read_text(encoding='utf-8'))
    doc.add_page_break();doc.add_heading('Diccionario de datos y relaciones',1)
    para(doc,'Referencia estructural de 27 tablas, 214 columnas y 44 relaciones de clave foránea. Los nombres se muestran en mayúsculas como los utiliza el SQL del backend. En Windows pueden almacenarse en minúsculas; en Linux debe conservarse la correspondencia exacta. PK indica clave primaria, FK clave foránea, UNIQUE unicidad y NULL que el campo puede quedar vacío.')
    para(doc,'Los tipos, valores predeterminados y restricciones siguientes provienen del inventario de estructura del proyecto. Antes de entregar, confirma con SHOW CREATE TABLE o el inspector de Workbench que tu base presentada conserva este esquema. [INSERTAR CAPTURA T08] Diagrama EER actualizado, generado desde la base presentada, no el diagrama inicial sin migraciones.')
    for item in schema['tables']:
        name=item['TABLE_NAME'];doc.add_heading(name.upper().replace('_',' '),2)
        p=para(doc,'Nombre SQL: '+name.upper()+'.')
        p.paragraph_format.keep_with_next=True
        cols=[c for c in schema['columns'] if c['TABLE_NAME']==name]
        rows=[['Campo','Tipo SQL','Restricciones y relaciones']]
        for c in cols:
            notes=['PK' if c['COLUMN_KEY']=='PRI' else 'UNIQUE' if c['COLUMN_KEY']=='UNI' else '']
            notes.append('NULL permitido' if c['IS_NULLABLE']=='YES' else 'NOT NULL')
            if c.get('EXTRA'):notes.append(c['EXTRA'])
            default=c.get('COLUMN_DEFAULT')
            if default is not None:notes.append('Predeterminado '+str(default))
            for key in schema['keys']:
                if key['TABLE_NAME']==name and key['COLUMN_NAME']==c['COLUMN_NAME'] and key.get('REFERENCED_TABLE_NAME'):
                    notes.append('FK '+key['REFERENCED_TABLE_NAME'].upper()+'.'+key['REFERENCED_COLUMN_NAME'])
            if c.get('GENERATION_EXPRESSION'):notes.append('Cálculo '+c['GENERATION_EXPRESSION'])
            rows.append([c['COLUMN_NAME'],c['COLUMN_TYPE'],'; '.join(n for n in notes if n)])
        current_table=table(doc,rows,[1.8,1.65,3.2],True)
        uniques={}
        for key in schema['keys']:
            if key['TABLE_NAME']==name and key['CONSTRAINT_NAME']!='PRIMARY' and not key.get('REFERENCED_TABLE_NAME'):
                uniques.setdefault(key['CONSTRAINT_NAME'],[]).append(key['COLUMN_NAME'])
        checks=[c['CHECK_CLAUSE'] for c in schema['checks'] if c['TABLE_NAME']==name]
        if uniques or checks:
            for cell in current_table.rows[-1].cells:
                for p in cell.paragraphs:p.paragraph_format.keep_with_next=True
            doc.paragraphs[-1].paragraph_format.keep_with_next=True
        if uniques:
            p=para(doc,'Claves únicas adicionales: '+'; '.join(k+' ('+', '.join(v)+')' for k,v in uniques.items())+'.')
            p.paragraph_format.keep_with_next=bool(checks)
        if checks:para(doc,'Restricciones CHECK: '+'; '.join(checks)+'.')
    doc.add_page_break()
    doc.add_heading('Consultas para revisar la base',1)
    doc.add_heading('Relaciones que debes explicar',2)
    para(doc,'ROL clasifica a USUARIO. Un cliente tiene PEDIDO y cada pedido tiene DETALLE_PEDIDO, pagos e historial. VENTA tiene DETALLE_VENTA y puede asociarse a un cliente o ser de público general. PRODUCTO pertenece a CATEGORIA_PRODUCTO y tiene RECETA; DETALLE_RECETA vincula ingredientes. COMPRA pertenece a PROVEEDOR y sus DETALLE_COMPRA indican los ingredientes recibidos. Los movimientos registran cambios de existencia; las transferencias, notificaciones, archivos privados y sesiones completan el control operativo.')
    para(doc,'Las relaciones inspeccionadas tienen acciones NO ACTION para actualización y borrado de sus claves. No se eliminan libremente registros con historial. USUARIO y varios maestros usan activo para conservar trazabilidad. Los campos de subtotal generados no deben incluirse como valores editables en una importación.')
    doc.add_heading('Comprobaciones de solo lectura en Workbench',2)
    para(doc,'Selecciona la base correcta antes de ejecutar. Estas consultas no cambian registros. Sirven para obtener evidencias del modelo, de los roles y de la consistencia de los importes. No incluyas filas con información personal en las capturas.')
    commands=[
        'SHOW TABLES;',
        'SELECT VERSION() AS motor_y_version;',
        'SELECT r.nombre AS rol, COUNT(*) AS cuentas\nFROM USUARIO u JOIN ROL r ON r.id_rol=u.id_rol\nGROUP BY r.nombre;',
        'SELECT v.id_venta, v.total,\n       COALESCE(SUM(d.subtotal),0) AS suma_detalles\nFROM VENTA v\nLEFT JOIN DETALLE_VENTA d ON d.id_venta=v.id_venta\nGROUP BY v.id_venta,v.total\nHAVING v.total <> COALESCE(SUM(d.subtotal),0);',
        'SELECT p.id_producto\nFROM PRODUCTO p\nLEFT JOIN CATEGORIA_PRODUCTO c\n  ON c.id_categoria=p.id_categoria\nWHERE c.id_categoria IS NULL;'
    ]
    for command in commands:
        p=para(doc,command);p.paragraph_format.line_spacing=1.0;p.paragraph_format.space_after=Pt(8)
        for r in p.runs:r.font.name='Consolas';r.font.size=Pt(9)
    para(doc,'En una base coherente, las dos últimas consultas no devuelven filas: cada venta coincide con sus detalles y cada producto tiene categoría. Si aparecen diferencias, registra la incidencia y revisa el origen; no ejecutes correcciones automáticas durante la presentación.')
    para(doc,'[COMPLETAR revisión del modelo] Fecha y motor de la base inspeccionada, responsable y explicación de cualquier diferencia de esquema encontrada. No inventes nuevas columnas en el diagrama para representar funciones que todavía no existen.')

def build(source, target, label):
    doc=base(label); lines=(SRC/source).read_text(encoding='utf-8').replace('\u200b','').splitlines()
    first=True;i=0;code=False
    while i<len(lines):
        line=lines[i].strip()
        if line=='<!-- PAGE -->':doc.add_page_break();i+=1;continue
        if line=='<!-- DICTIONARY -->':dictionary(doc);i+=1;continue
        if line.startswith('```'):code=not code;i+=1;continue
        if code:
            p=para(doc,lines[i]);p.paragraph_format.space_after=Pt(2);p.paragraph_format.line_spacing=1.0
            for r in p.runs:r.font.name='Consolas';r.font.size=Pt(9)
            i+=1;continue
        if not line:i+=1;continue
        if line.startswith('|'):
            rows=[]
            while i<len(lines) and lines[i].strip().startswith('|'):
                row=[v.strip() for v in lines[i].strip().strip('|').split('|')]
                if not all(re.fullmatch(r'[:\- ]+',v) for v in row):rows.append(row)
                i+=1
            table(doc,rows);continue
        if line.startswith('# '):
            para(doc,line[2:],'Title' if first else 'Heading 1');first=False
        elif line.startswith('## '):para(doc,line[3:],'Heading 2')
        elif re.match(r'^\d+\. ',line):
            p=para(doc,line);p.paragraph_format.left_indent=Inches(.12);p.paragraph_format.first_line_indent=Inches(-.12)
        else:para(doc,line)
        i+=1
    path=OUT/target;doc.core_properties.title=doc.paragraphs[0].text;doc.save(path)
    print(json.dumps({'archivo':str(path),'parrafos':len(doc.paragraphs),'tablas':len(doc.tables)},ensure_ascii=False))

if __name__=='__main__':
    OUT.mkdir(parents=True,exist_ok=True)
    build('manual_tecnico.md','Manual_tecnico_Dulce_Rincon.docx','Manual técnico')
    build('manual_usuario.md','Manual_usuario_Dulce_Rincon.docx','Manual de usuario')
    build('casos_presentacion.md','Casos_prueba_presentacion_Dulce_Rincon.docx','Pruebas y presentación')
