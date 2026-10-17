/**
 * Backend de Apps Script para el Tablero Gestión Operativa.
 * Guarda la base cargada diariamente en una hoja de Google Sheets
 * y la expone como API para que el HTML la lea/escriba.
 *
 * PRIMER DEPLOY:
 * 1. Extensiones > Apps Script en tu Google Sheet.
 * 2. Pegar este archivo como Code.gs.
 * 3. Implementar > Nueva implementación > Tipo: Aplicación web.
 *    - Ejecutar como: Yo
 *    - Quién tiene acceso: Cualquier usuario
 * 4. Copiar la URL de la app web (termina en /exec).
 *
 * ACTUALIZAR EL CÓDIGO (sin cambiar la URL):
 *    Implementar > Administrar implementaciones > lápiz (editar) >
 *    Versión: "Nueva versión" > Implementar.
 *    NO usar "Nueva implementación": eso crea una URL distinta y el
 *    tablero seguiría hablando con la versión vieja.
 */

const SHEET_NAME = 'Datos';
const BACKUP_NAME = 'Datos_backup';   // copia de la carga anterior, por si hay que recuperar
const TMP_NAME = 'Datos_tmp';
const API_VERSION = 3;                // el tablero lo chequea antes de subir: si no coincide, no sube

// Campos que se guardan por cada orden (mismo orden que GAS_FIELDS en index.html)
const FIELDS = [
  'orden','cliente','patente','asesor','sucursal','estado','tipologia','subtipologia',
  'fApertura','mesApertura','pedido','numeroPedido','fConfirm',
  'moFacturada','matCosto','matFacturado','moExterna','matExterno',
  'estadoPedido','tarea1','preentrega','tiempoTotalHrs',
  'fCierreTaller','fCierreFacturacion',
  'fPedidoFabrica','fPreCarga','fConfirmRepuestos',
  'horaApertura','fMarcacion1','horaMarcacion1','fUltimaMarcacion','horaUltimaMarcacion',
  'fCierreJT','horaCierreJT','fFacturacion','fVale',
  'fTurno','horaTurno','horaPreRecepcion','horaRecepcion','horaFacturadas',
  'modelo','km','chasis','diasTaller','tareas'
];

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(FIELDS);
  }
  return sheet;
}

function output_(obj, callback) {
  const payload = JSON.stringify(obj);
  if (callback) {
    return ContentService
      .createTextOutput(callback + '(' + payload + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(payload).setMimeType(ContentService.MimeType.JSON);
}

function lastPost_() {
  const raw = PropertiesService.getScriptProperties().getProperty('lastPost');
  try { return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
}

/** GET: devuelve la base guardada. Soporta JSONP vía ?callback=nombre.
 *  ?meta=1 → respuesta liviana (versión, cantidad de filas, resultado de la última subida)
 *  sin traer la base completa; el tablero la usa para chequear antes y después de subir.
 *  Las filas viajan como arrays alineados a "fields" (no objetos) para no repetir los
 *  nombres de columna en cada fila: payload mucho más chico con bases de miles de órdenes. */
function doGet(e) {
  const p = (e && e.parameter) || {};
  const sheet = getSheet_();
  const lastRow = sheet.getLastRow();
  const lastUpdated = PropertiesService.getScriptProperties().getProperty('lastUpdated') || '';

  if (p.meta) {
    const count = lastRow > 1
      ? sheet.getRange(2, 1, lastRow - 1, 1).getValues().filter(r => r[0] !== '' && r[0] !== null).length
      : 0;
    return output_({ version: API_VERSION, count: count, lastUpdated: lastUpdated, lastPost: lastPost_() }, p.callback);
  }

  let rows = [];
  if (lastRow > 1) {
    const values = sheet.getRange(2, 1, lastRow - 1, FIELDS.length).getValues();
    rows = values.filter(r => r[0] !== '' && r[0] !== null);
  }
  return output_({ version: API_VERSION, fields: FIELDS, rows: rows, lastUpdated: lastUpdated }, p.callback);
}

/** POST: reemplaza la base con la última carga diaria.
 *  Body: {rows:[[...],[...],...], updatedLabel:"..."} — filas como arrays alineados a FIELDS
 *  (también tolera filas como objetos, formato viejo).
 *
 *  Escritura segura: la base nueva se escribe primero en una hoja temporal. Solo si esa
 *  escritura termina bien se reemplaza "Datos" (y la anterior queda como "Datos_backup").
 *  Si algo falla a mitad de camino, "Datos" queda intacta — antes se borraba primero y,
 *  si la escritura fallaba, la hoja quedaba vacía.
 *  El resultado (ok / error) queda guardado para que el tablero lo lea vía ?meta=1, ya que
 *  el navegador no puede leer la respuesta directa de este POST. */
function doPost(e) {
  const props = PropertiesService.getScriptProperties();
  const lock = LockService.getScriptLock();
  let received = 0;
  try {
    lock.waitLock(30000); // evita dos subidas pisándose
    const body = JSON.parse(e.postData.contents);
    const rows = body.rows || [];
    received = rows.length;
    if (!rows.length) throw new Error('La carga no trae filas. No se modificó la base guardada.');

    const isArrayFormat = Array.isArray(rows[0]);
    const values = rows.map(r => FIELDS.map((f, i) => {
      const v = isArrayFormat ? r[i] : r[f];
      return (v === undefined || v === null) ? '' : v;
    }));
    const conOrden = values.filter(v => v[0] !== '').length;
    if (!conOrden) throw new Error('Ninguna fila trae número de orden. No se modificó la base guardada.');

    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // 1) Escribir en hoja temporal
    let tmp = ss.getSheetByName(TMP_NAME);
    if (tmp) ss.deleteSheet(tmp);
    tmp = ss.insertSheet(TMP_NAME);
    const needRows = values.length + 1;
    if (tmp.getMaxRows() < needRows) tmp.insertRowsAfter(tmp.getMaxRows(), needRows - tmp.getMaxRows());
    if (tmp.getMaxColumns() < FIELDS.length) tmp.insertColumnsAfter(tmp.getMaxColumns(), FIELDS.length - tmp.getMaxColumns());
    tmp.getRange(1, 1, 1, FIELDS.length).setValues([FIELDS]);
    tmp.getRange(2, 1, values.length, FIELDS.length).setValues(values);
    SpreadsheetApp.flush();

    // 2) Recién ahora rotar: Datos → Datos_backup, Datos_tmp → Datos
    const oldBackup = ss.getSheetByName(BACKUP_NAME);
    if (oldBackup) ss.deleteSheet(oldBackup);
    const current = ss.getSheetByName(SHEET_NAME);
    if (current) current.setName(BACKUP_NAME);
    tmp.setName(SHEET_NAME);

    const label = body.updatedLabel || new Date().toISOString();
    props.setProperty('lastUpdated', label);
    props.setProperty('lastPost', JSON.stringify({ ok: true, count: conOrden, received: received, at: new Date().toISOString() }));
    return output_({ ok: true, count: conOrden });
  } catch (err) {
    // Si quedó una hoja temporal a medio escribir, se descarta; "Datos" no se tocó.
    try {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const tmp = ss.getSheetByName(TMP_NAME);
      if (tmp && ss.getSheetByName(SHEET_NAME)) ss.deleteSheet(tmp);
    } catch (e2) {}
    props.setProperty('lastPost', JSON.stringify({ ok: false, error: String(err && err.message || err), received: received, at: new Date().toISOString() }));
    return output_({ ok: false, error: String(err && err.message || err) });
  } finally {
    try { lock.releaseLock(); } catch (e3) {}
  }
}
