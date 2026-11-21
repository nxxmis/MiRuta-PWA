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

### 6. 🏖️ Exoneración de Cuotas / Semanas (Vacaciones y Asuetos Escolares)
- **Cero Deudas Injustas en Vacaciones:** Permite registrar períodos no laborables, vacaciones de Navidad, Carnaval, Semana Santa o suspensiones de clases fijando la cuota en `$0.00`, evitando que las familias se marquen en rojo como deudoras morosas.
- **Acceso Directo Integrado en "Registrar Pago":** Al abrir la ventana de cobro de una familia o cuota semanal específica, se puede alternar instantáneamente mediante un conmutador superior o enlace rápido al modo *"Exonerar período"*. Esto fija de inmediato la cuota en `$0.00`, despliega las pastillas de motivo rápido ("🏖️ Vacaciones", "📅 Feriado", etc.) y guarda la exoneración en un solo toque sin tener que cerrar el modal ni volver a seleccionar la familia.
- **Dos Modos de Aplicación:**
  - **Individual (desde el modal de pago o botón familiar):** Exonera a una familia específica seleccionando la familia, semanas deseadas y motivo.
  - **Grupal ("Toda la Ruta"):** Aplica la exoneración a todas las familias activas en un solo paso con confirmación de seguridad.
- **Pastillas de Motivo Rápido:** Selección con un clic de *"🏖️ Vacaciones"*, *"🛑 Suspensión"*, *"📅 Feriado"* o *"🤝 Acuerdo"*, más campo libre para especificar motivos personalizados.
- **Protección de Pagos Previos:** Opción configurable para conservar cuotas adelantadas que una familia ya haya pagado o sobreescribirlas si corresponde.
- **Visualización en Cuotas y Listas:**
  - Las semanas exoneradas se identifican con un botón/badge slate con icono de sombrilla (`beach_access`) en lugar de rojo (deuda) o verde (pago).
  - El pie de tarjeta de la familia muestra el distintivo *"Al día ✨"* junto a una píldora con el conteo de semanas exoneradas (ej. `2 sem. exoneradas`).
- **Comprobante Oficial de Exoneración (Canvas 2D PNG):**
  - Genera una tarjeta de alta definición estilo bancario con cabecera en azul cielo/océano, título *"MiRuta • Comprobante de Exoneración"*, número `#EXO-XXXX`, sello oficial **🏖️ CUOTA EXONERADA ($0.00)**, motivo registrado y rango de fechas.
  - Botones funcionales para compartir por WhatsApp mediante Web Share API y descargar en PNG.
- **Cálculos Financieros Impecables:**
  - Las cuotas exoneradas no suman al monto adeudado ni inflan el total recaudado en los resúmenes financieros de Inicio y Pagos.

### 7. 📅 Control de Asistencia Diaria y Semanal con Estado "No asistió"
- **Tres Estados Interactivos:** Soporta `En espera ⏳`, `Abordado ✅` y el nuevo estado `No asistió ❌` (con distintivo rojo suave e ícono `person_off`), permitiendo registrar ausencias tanto desde la tarjeta rápida de Inicio como en el historial semanal.
- **Historial Completo por Fecha (`[childId+date]`):** La tabla `attendance` en Dexie.js indexa y filtra estrictamente por la fecha actual del sistema en formato `YYYY-MM-DD`.
- **Reinicio Automático Cada Día:** Cada nuevo día de calendario todos los estudiantes inician automáticamente en `En espera ⏳`.
- **Preservación de Historial:** Todos los registros de asistencia de días anteriores permanecen intactos en IndexedDB para auditoría y consulta.

### 8. 🔍 Buscador Instantáneo en Inicio, Familias y Pagos
- **Búsqueda en Tiempo Real sin Acentos:** En Inicio, Familias y Pagos, las barras de búsqueda filtran instantáneamente normalizando mayúsculas, minúsculas y tildes (`normalize('NFD')`), permitiendo encontrar de inmediato a cualquier estudiante o representante.
- **Botón Rápido de Limpieza (✕):** Aparece automáticamente al escribir para vaciar el término de búsqueda con un solo toque y restaurar el listado completo.
- **Operatividad en Resultados Filtrados:** Se puede marcar asistencia, abrir detalles o modificar el orden de ruta directamente sobre los resultados filtrados.

### 9. 🔀 Orden Personalizado de Recogida y Entrega por Turno
- **Campos `ordenManana` y `ordenTarde`:** Permite organizar la secuencia exacta en que se recoge o entrega a los estudiantes en cada turno.
- **Modo "Ordenar ruta":** Botón en la cabecera de la lista de alumnos que activa botones táctiles grandes de Subir (▲) y Bajar (▼) en cada tarjeta, guardando el nuevo orden inmediatamente en IndexedDB.
- **Badges Numéricos de Parada:** Cada alumno exhibe su número de orden (`#1`, `#2`, `#3`...) sobre su avatar para guiar visualmente la ruta.

### 10. 📋 Portapapeles Robusto Universal (`copyToClipboard`)
- Función auxiliar resiliente con fallback inteligente: intenta primero la moderna Clipboard API en contextos seguros y, en redes locales HTTP (por ejemplo al probar en el teléfono via `http://192.168.x.x:8080`) o navegadores móviles con restricciones de seguridad, activa el fallback con `<textarea>` invisible y `document.execCommand('copy')` con fuente de 16px para evitar auto-zoom en iOS Safari.
- Muestra siempre una confirmación toast verde con icono de check: *"¡Copiado al portapapeles!"*.

### 11. 🛡️ Protección de Interfaz (Anti-Bloqueo de Netlify)
- Regla CSS dedicada que oculta badges o drawers flotantes inyectados por Netlify (`iframe[src*="netlify"]`, `[data-netlify-deploy-id]`, etc.) garantizando que nunca se obstaculicen los botones de navegación inferior ("Pagos" y "Ajustes").

### 12. 🔔 Campanita de Alertas Activas y Menú Flotante Speed Dial (+)
- **Campanita Superior:** Notifica en un modal deslizable tanto los cumpleaños próximos como las familias que tienen cuotas pendientes en la semana en curso.
- **Botón Flotante (+) con Menú Speed Dial:**
  - En **Inicio**: Despliega un menú flotante vertical hacia arriba con backdrop translúcido y rotación a "✕", ofreciendo accesos directos al alcance del pulgar:
    - *Registrar Pago* (abre el modal de cobro/pago).
    - *Ir a Familias* (navega al directorio).
    - *Ir a Pagos* (navega al control semanal).
    - *Ir a Ajustes* (navega a la configuración).
  - En **Familias**: Abre directamente el modal *Nueva Familia y Niños*.
  - En **Pagos**: Abre directamente el modal *Registrar Pago*.

### 13. ⚙️ Vista de Ajustes e Identidad Oficial
- **Logo Oficial de MiRuta:** Integrado en la cabecera superior, pantalla de carga y en la sección de Ajustes con el isotipo centrado y libre de bordes residuales.
- **Splash Screen (Pantalla de Carga):** Animación de apertura suave que exhibe el isotipo oficial, la tipografía de marca y el eslogan: *"Tu transporte escolar, organizado y al día"*.
- **📖 Guía Rápida de Uso Integrada (Exportable a PDF):** Tarjeta responsiva rediseñada que no se desborda en pantallas móviles, con botón directo para **Guardar PDF / Imprimir** en 4 pasos esenciales (Perfil/Pago Móvil, Familias y Hermanos con descuento, Pagos semanales y Recibos por WhatsApp, y Respaldo mensual en JSON).
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

### 14. 👆 Navegación Táctil por Deslizamiento Lateral (Swipe entre Pestañas)
- **Gestos Táctiles Optimizados:** Deslizar el dedo horizontalmente en cualquier parte de la pantalla conmuta de forma natural entre las 4 pestañas principales: `Inicio` $\leftrightarrow$ `Familias` $\leftrightarrow$ `Pagos` $\leftrightarrow$ `Ajustes`.
- **Compatibilidad Chrome en Android e iOS:** Reglas CSS nativas (`touch-action: pan-y; overscroll-behavior-x: none`) que impiden que el navegador interfiera o cancele el deslizamiento.
- **Detección Directa y Confiable:** Detección en `document` que simula el clic directo sobre el botón correspondiente de la barra inferior con un umbral sensible de 50px (`Math.abs(deltaX) > 50 && Math.abs(deltaX) > Math.abs(deltaY) * 1.3`).
- **Seguridad y Anti Falsos Positivos:** Ignora el gesto si el usuario está escribiendo en campos de formulario (`input`, `textarea`, `select`) o si hay un modal abierto.
- **Transición Visual Fluida:** Animación CSS con aceleración de hardware para un cambio de vista suave y moderno.

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
