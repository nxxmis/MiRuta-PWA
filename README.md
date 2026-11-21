# 🚍 MiRuta - Transporte Escolar (PWA Offline-First)

**MiRuta** es una Progressive Web App (PWA) 100% local y offline-first diseñada específicamente para la administración operativa y financiera del transporte escolar desde teléfonos móviles, sin necesidad de servidores ni conexión a internet continua.

---

## ✨ Características Principales

### 1. ⚡ Arquitectura 100% Offline-First (IndexedDB con Dexie.js)
- **Cero backend ni servidor:** Todos los datos (familias, niños, pagos, asistencia diaria, datos de vehículos y ajustes) se guardan en el almacenamiento local del navegador del teléfono mediante **Dexie.js / IndexedDB**.
- **Service Worker (`sw.js`) con Caché Completo:** Pre-almacena en caché todos los activos de la aplicación (HTML, CSS Tailwind, scripts Dexie, íconos y fuentes) para garantizar funcionamiento instantáneo sin internet.
- **PWA Instalable:** Incluye `manifest.json` e íconos en alta resolución (192x192, 512x512 y maskable) para instalarse como una app nativa en Android (Chrome) e iOS (Safari).

### 2. 🏠 Pantalla de Inicio (Dashboard Operativo)
- **Estética Stitch Unificada:** Basada en el sistema de diseño visual *Vibrant School Transit* (Plus Jakarta Sans, paleta ámbar/esmeralda/slate).
- **Tarjetas de Niños Adaptadas:**
  - Avatares con iniciales y distintivo de color en lugar de fotos externas.
  - Indicador de cumpleaños festivo (🎂) si está próximo.
  - Representante a cargo (`Rep: María González`).
  - Chip con el Colegio correspondiente.
  - Chip del Turno (`Mañana` o `Tarde`).
  - Píldora de Modalidad: `Transporte Completo` (azul), `Solo ida` (ámbar cálido) o `Solo vuelta` (ámbar cálido).
  - Botón de chat directo por WhatsApp con el representante.
  - Botón interactivo de Asistencia: `En espera ⏳` $\leftrightarrow$ `Abordado ✅` con guardado instantáneo en la base de datos para el día en curso.
  - **Modal de Detalle y Asistencia Semanal por Niño:** Al tocar cualquier tarjeta (con `e.stopPropagation()` para aislar el botón de cambio rápido), se abre una vista detallada con:
    - Datos del alumno, colegio, turno, modalidad y representante con contacto directo.
    - **Total de Días Asistidos en el Mes:** Métrica acumulada de asistencia mensual leyendo directamente de Dexie.js.
    - **Navegador Semanal (Lunes a Viernes):** Flechas para consultar semanas pasadas/futuras, indicador de `HOY` y estado de abordaje por día, con posibilidad de alternar asistencia de días previos.
- **Sin distracciones:** Se eliminaron las referencias a paradas GPS, estimaciones ETA y banners de congestión de tráfico según lo solicitado.

### 3. 🎂 Alertas Inteligentes de Cumpleaños
- **Banner Ámbar Superior:** Analiza automáticamente en IndexedDB las fechas de nacimiento de los niños y alerta si cumplen años en los próximos 5 días (o el rango configurado en Ajustes).
- **Acción Rápida de Felicitación:** Botón directo a WhatsApp (`wa.me`) con mensaje pre-redactado y personalizado con el nombre del niño y representante.

### 4. 👥 Directorio de Familias
- **Agrupación de Hermanos:** Permite registrar familias con uno o más hermanos bajo una tarifa semanal unificada con descuento grupal.
- **Búsqueda y Filtros Rápidos:** Búsqueda en tiempo real por nombre de familia, niño, colegio o dirección, más filtros rápidos (*Todas*, *Con Hermanos*, *Pendientes*, *Al Día*).
- **Acciones Directas:** Llamar (`tel:`), abrir chat de WhatsApp (`wa.me`), editar o eliminar familia.

### 5. 💳 Control de Pagos Semanales y Comprobantes Bancarios en Imagen (PNG)
- **Selector de Mes y Cálculo de Semanas:** Navegación por meses con cálculo automático de las semanas lectivas (Semana 1 a Semana 4/5).
- **Métricas Financieras en Vivo:** Muestra el saldo pendiente por cobrar, el total recaudado y la tasa de cumplimiento del mes.
- **Grilla de Cuotas Semanales:** Cada familia muestra sus semanas en verde (`Pagada`) o rojo (`Pendiente`). Al tocar una cuota pendiente, se abre el modal para cobrarla de inmediato.
- **Modal Bottom Sheet:**
  - Métodos soportados: **Pago Móvil** (con campo para últimos dígitos de referencia), **Efectivo** y **Transferencia**.
  - Validación y registro en la base de datos local.
- **Comprobante de Pago en Formato Imagen PNG (Estilo Bancario en Canvas 100% Offline):**
  - Generador visual en HTML5 `<canvas>` (sin librerías externas ni consumo de internet).
  - Produce una tarjeta tipo recibo de transferencia bancaria de alta resolución (Retina 2x, 1200x1640 basado en 600x820 px) con:
    - Logo oficial de MiRuta (`logo-miruta.png` cargado localmente con fallback vectorial garantizado) sobre cabecera en verde esmeralda con franja dorada y título oficial *MiRuta • Comprobante de Pago*.
    - Sello verde oficial de **✓ PAGO CONFIRMADO**.
    - Monto destacado en grande (`$XX.XX`) y período lectivo.
    - Muescas laterales de perforación de ticket.
    - Datos detallados: Fecha y hora exacta, Representante, Alumno(s), Colegio (muestra el colegio del alumno o los colegios de los hermanos separados por coma, o 'No especificado'), Período, Método, Referencia destacada y Unidad de ruta.
    - Código de validación de seguridad y firma de marca oficial.
  - **Compartir Imagen (WhatsApp):** Utiliza la **Web Share API** (`navigator.share({ files: [...] })`) para enviar la imagen generada directamente por **WhatsApp** desde el teléfono celular.
  - **Descargar Comprobante PNG:** Botón para guardar la imagen en el carrete/almacenamiento del teléfono.
  - **Copiar Texto:** Con respaldo formateado y firma de marca elegante:
    ```text
    ────────────────────
    🚐 *MiRuta* • Transporte Escolar
    ```

### 6. 📅 Asistencia Diaria Estricta por Fecha del Sistema
- **Historial Completo por Fecha (`[childId+date]`):** La tabla `attendance` en Dexie.js indexa y filtra estrictamente por la fecha actual del sistema en formato `YYYY-MM-DD`.
- **Reinicio Automático Cada Día:** Cada nuevo día de calendario todos los estudiantes inician automáticamente en `En espera ⏳`.
- **Preservación de Historial:** Todos los registros de asistencia de días anteriores permanecen intactos en IndexedDB para auditoría y consulta.

### 7. 📋 Portapapeles Robusto Universal (`copyToClipboard`)
- Función auxiliar resiliente con fallback inteligente: intenta primero la moderna Clipboard API en contextos seguros y, en redes locales HTTP (por ejemplo al probar en el teléfono via `http://192.168.x.x:8080`) o navegadores móviles con restricciones de seguridad, activa el fallback con `<textarea>` invisible y `document.execCommand('copy')` con fuente de 16px para evitar auto-zoom en iOS Safari.
- Muestra siempre una confirmación toast verde con icono de check: *"¡Copiado al portapapeles!"*.

### 8. 🔔 Campanita de Alertas Activas y Botón Flotante (+)
- **Campanita Superior:** Notifica en un modal deslizable tanto los cumpleaños próximos como las familias que tienen cuotas pendientes en la semana en curso.
- **Botón Flotante (+):** Inteligente y contextual:
  - En **Inicio** y **Pagos**: Abre el modal *Registrar Pago*.
  - En **Familias**: Abre el modal *Nueva Familia y Niños*.

### 9. ⚙️ Vista de Ajustes e Identidad Oficial
- **Logo Oficial de MiRuta:** Integrado en la cabecera superior, pantalla de carga y en la sección de Ajustes con el isotipo centrado y libre de bordes residuales.
- **Splash Screen (Pantalla de Carga):** Animación de apertura suave que exhibe el isotipo oficial, la tipografía de marca y el eslogan: *"Tu transporte escolar, organizado y al día"*.
- **📖 Guía Rápida de Uso Integrada (Exportable a PDF):** Vista ilustrada con iconos que explica en 4 pasos esenciales cómo usar la app (Perfil/Pago Móvil, Familias y Hermanos con descuento, Pagos semanales y Recibos por WhatsApp, y Respaldo mensual en JSON), con botón directo para **Imprimir o Guardar como PDF**.
- **Firma de Marca en Recibos WhatsApp:** Todos los comprobantes generados para representantes cierran con la firma oficial:
  ```text
  ────────────────────
  🚐 *MiRuta* • Transporte Escolar
  ```
- **Datos del Transportista y Vehículo:** Nombre del conductor (actualiza el saludo *"¡Hola, [Nombre]!"*), teléfono, unidad (`Móvil #04`), modelo y placa.
- **Aviso de Cumpleaños:** Slider para ajustar los días de anticipación de alertas (1 a 15 días).
- **Datos de Pago Móvil:** Permite guardar Banco, Cédula/RIF y Teléfono con botón de un solo toque: *"Copiar datos de Pago Móvil"* para enviar instrucciones a los representantes.
- **Catálogo de Colegios:** Permite añadir y eliminar colegios que luego alimentan las listas desplegables al registrar alumnos.
- **Respaldo y Restauración (.json):** Exporta toda la base de datos local a un archivo `.json` descargable y permite restaurar respaldos en cualquier momento.

---

## 🚀 Cómo Ejecutar la Aplicación

Debido a que los Service Workers y las PWAs requieren ejecutarse bajo el protocolo HTTP/HTTPS (o localhost), puedes servir la carpeta con cualquier servidor web estático local:

### Opción A: Con Node.js / npx
```bash
npx serve .
```

### Opción B: Con Python 3
```bash
python3 -m http.server 8080
```
Luego abre en el navegador de tu computadora o teléfono:
`http://localhost:8080` (o la IP local de tu red WiFi, ej. `http://192.168.1.X:8080`).

---

## 📱 Cómo Instalar en la Pantalla de Inicio del Teléfono

1. Abre la aplicación en el navegador del teléfono (**Chrome** en Android o **Safari** en iPhone).
2. **En Android (Chrome):** Toca los tres puntos `⋮` arriba a la derecha y selecciona **"Instalar aplicación"** o **"Añadir a la pantalla de inicio"**.
3. **En iPhone (Safari):** Toca el botón de Compartir y selecciona **"Añadir a pantalla de inicio"**.
4. ¡Listo! MiRuta se abrirá en pantalla completa como una app nativa, funcionando incluso en Modo Avión o sin conexión a internet.
