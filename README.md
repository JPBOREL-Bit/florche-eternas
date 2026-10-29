# Florche.Eternas – Tienda online

Tienda de flores de cinta de raso con panel de administración.
El cliente arma su pedido, elige cómo lo recibe (envío propio en Mendoza, Andreani o Correo Argentino) y lo manda. El pedido queda en tu panel y le podés escribir por WhatsApp, o pagarlo online con Mercado Pago.

- Tienda: `https://florcheterna.store/`
- Panel: `https://florcheterna.store/admin`

---

## Dominio propio (florcheterna.store)

Con el dominio nuevo hay que actualizar estas cosas **una sola vez**:

1. **Render, variable `PUBLIC_URL`** = `https://florcheterna.store` (sin barra al final) y reiniciar. Es la dirección que usan Mercado Pago (para volver a la tienda y para avisar los pagos) y las notificaciones. Mientras no esté, usan la dirección vieja `.onrender.com`. Con `PUBLIC_URL` puesta, **quien entre por la dirección vieja pasa solo a la nueva**.
2. **Google (reseñas e ingreso con Google):** en Google Cloud, **Credenciales > tu ID de cliente de OAuth > Orígenes autorizados de JavaScript**, agregá `https://florcheterna.store` (y también `https://www.florcheterna.store` si lo usás). Sin esto el botón de Google deja de funcionar en el dominio nuevo.
3. **Mercado Pago:** en la configuración de avisos (webhook) poné `https://florcheterna.store/api/mp/webhook`. La dirección exacta figura en el panel, **Mi tienda > Cobro con Mercado Pago**.
4. **Notificaciones del celular:** las notificaciones son por dirección, así que hay que **volver a activarlas** entrando al panel desde `florcheterna.store/admin` (pestaña **Notificaciones**). También tenés que volver a iniciar sesión en el panel.
5. **Links:** actualizá los de Instagram y WhatsApp, por ejemplo `https://florcheterna.store/?origen=instagram`.

Los carritos y favoritos que los clientes tenían guardados en el celular están asociados a la dirección vieja, así que en el dominio nuevo empiezan de cero. Es normal.

## Cómo actualizar una tienda que ya está publicada

1. Descomprimí este zip **sobre la carpeta de tu repositorio** (aceptá reemplazar los archivos).
2. En PowerShell:

```powershell
cd C:\Proyectos\florche-eternas
git add .
git commit -m "Dashboard, cupones, descuentos y mejoras"
git push
```

3. Render se actualiza solo (tarda un par de minutos). **No perdés nada**: productos, fotos, ajustes y códigos postales quedan como están. Las tablas nuevas se crean solas.

## Instalación desde cero

### 1. Base de datos (Supabase, gratis)
1. En https://supabase.com creá un proyecto y **guardá la contraseña**.
2. Tocá **Connect**, elegí **Session pooler** y copiá la cadena `postgresql://...` (el usuario es `postgres.CODIGO`).
3. Reemplazá `[YOUR-PASSWORD]` por tu contraseña (sin corchetes). Esa cadena es tu `DATABASE_URL`.

### 2. GitHub
Creá un repositorio, clonalo **fuera de OneDrive**, descomprimí el zip adentro y hacé `git add .`, `git commit`, `git push`.

### 3. Render
1. **New > Web Service**, elegí el repositorio.
2. **Build Command:** `npm install` · **Start Command:** `npm start`
3. En **Environment** cargá:

| Nombre | Valor |
|---|---|
| `DATABASE_URL` | la cadena de Supabase |
| `ADMIN_PASSWORD` | la contraseña para entrar al panel |
| `JWT_SECRET` | cualquier frase larga |
| `GOOGLE_CLIENT_ID` | para las reseñas y el ingreso con Google (ver sección **Reseñas**). Podés agregarla más tarde |
| `ANDREANI_USER`, `ANDREANI_PASS`, `ANDREANI_CONTRACT_DOM` | envíos por Andreani (ver **Envíos por correo**) |
| `MICORREO_USER`, `MICORREO_PASS`, `MICORREO_CUSTOMER_ID` | envíos por Correo Argentino (ver **Envíos por correo**) |
| `PUBLIC_URL` | tu dominio, por ejemplo `https://florcheterna.store` (ver **Dominio propio**) |
| `MP_ACCESS_TOKEN` | clave de Mercado Pago, solo si querés cobrar con "Terminar pedido" (ver sección **Mercado Pago**) |

---

## Qué hay en el panel (`/admin`)

**Resumen** – Visitantes, carritos creados, pedidos mandados, ventas realizadas, rechazadas, pendientes y **Ganancias**. Podés ver Hoy, 7 días, 30 días o Todo. Incluye el recorrido de la venta (entraron → vieron un producto → agregaron al carrito → enviaron pedido → venta realizada), gráficos por día y una tabla por producto (cuánta gente lo vio, cuántos lo agregaron al carrito y cuánto vendió).
Tus propias visitas desde el panel no se cuentan.

**Pedidos** – Cada vez que un cliente toca **Mandar pedido** queda registrado acá con su nombre, **WhatsApp** (con un botón **Escribirle**), la dirección, para cuándo lo necesita y si **pagó con Mercado Pago**. Cuando entra uno nuevo te suena una alerta en el panel y te llega la notificación al celular (ver **Notificaciones**). Los marcás como **Venta realizada** o **Rechazar**. Al **rechazar** se borran los datos del cliente y del pedido (sin vuelta atrás, por eso pide confirmación; el Resumen conserva solo el conteo).

**Cuentas** – Clientas con cuenta, solicitudes de "olvidé mi contraseña", dispositivo y bloqueo (ver sección **Cuentas de clientes**).

**Mayoristas** – Solicitudes de compradores por mayor, compradores aceptados y sus compras (ver sección **Mayoristas**).

**Calculadora** – Tus costos: materia prima, productos con receta, tiempo y precio recomendado (ver sección **Calculadora de costos**).

**Productos** – Fijar arriba del catálogo, ponerles **descuento** (porcentaje o monto fijo, con fecha de vencimiento opcional), opciones con precio, fotos.

**Cupones** – Los creás vos: nombre, porcentaje o monto en pesos (o envío gratis), compra mínima, descuento máximo (tope), productos a los que aplica, vencimiento, cantidad de usos y activar/desactivar. Ejemplos: "50% en productos elegidos" o "$4.000 de descuento comprando más de $20.000". El cliente lo escribe al final del carrito (es opcional).

**Promos** – Mensajes que rotan en la barra de arriba (uno por línea) y la **barra de progreso** del carrito: definís niveles por monto (envío gratis, descuento % o $, o un regalo) y se desbloquean solos a medida que el cliente suma plata.

**Envíos** – Tu código postal, precio por km y mínimo. El sistema busca solo los km (solo Mendoza). El envío es **solo orientativo**: se muestra al cliente pero no se suma al total ni va en el mensaje de WhatsApp.

**Notificaciones** – Activar los avisos al celular Android (ver sección **Notificaciones en el celular**).

**Mi tienda** – Nombre, textos, WhatsApp, **botón flotante de WhatsApp**, **cobro con Mercado Pago**, color, logo y **banner de portada** (conviene una foto horizontal, por ejemplo 1600×600; se muestra completa). El botón "Optimizar fotos ya subidas" comprime las fotos que subiste antes.

## Reseñas

Al final de la tienda aparece la sección **Reseñas**: puntuación general (por ejemplo 4.3, o 0.0 si todavía no hay), barras de 5 a 1 estrella con cuántas personas puso cada una, los comentarios pasando solos (con nombre y Gmail parcialmente tapados y "hace cuánto"), el botón **Dejá tu reseña** y **Ver todos los comentarios**. Ese botón lleva a la página `/resenas`, donde se puede filtrar por estrellas, ver la fecha de cada reseña y también dejar una.

- Para opinar hay que poner **estrellas (obligatorio, de 1 a 5)**, **nombre** y **Gmail verificado con Google**. El comentario es opcional.
- El Gmail se verifica con "Continuar con Google": así es una cuenta real y de esa persona. Solo se aceptan cuentas @gmail.com.
- Se rechazan los Gmail con palabras raras o prohibidas (incluso disfrazadas, como "f4ke"), con letras repetidas o con demasiados números. La lista de palabras la editás en el panel, pestaña **Reseñas**.
- Una reseña por cuenta de Gmail: si la misma persona vuelve a opinar, se actualiza la anterior.
- En la tienda nunca se ve el Gmail completo. En el panel sí.
- Desde el panel podés **ocultar** o **borrar** cualquier reseña.

### Cómo conectar Google (una sola vez, gratis, unos 10 minutos)

1. Entrá a **console.cloud.google.com** con tu cuenta de Google y creá un proyecto (por ejemplo "Florche").
2. Andá a **APIs y servicios > Pantalla de consentimiento de OAuth**, elegí **Externo**, poné el nombre de tu tienda y tu mail, y al final tocá **Publicar aplicación** (así cualquier persona puede entrar con su cuenta).
3. Andá a **Credenciales > Crear credenciales > ID de cliente de OAuth** y elegí **Aplicación web**.
4. En **Orígenes autorizados de JavaScript** agregá la dirección de tu tienda, por ejemplo `https://florche-eternas.onrender.com` (y tu dominio propio si más adelante tenés uno).
5. Copiá el **ID de cliente** (termina en `.apps.googleusercontent.com`).
6. En Render, **Environment**, agregá la variable `GOOGLE_CLIENT_ID` con ese valor y guardá. Render se reinicia solo.

Hasta que lo hagas, la sección de reseñas no se muestra a tus clientes (así no ven un botón que no funciona). En el panel, pestaña **Reseñas**, aparece "Conectado" cuando está lista. Si alguna pantalla de Google se ve distinta a lo que dice acá, pedime ayuda con una captura.

## Favoritos y compartir

- Cada producto tiene un corazón para **marcarlo como favorito** (en el catálogo y dentro del producto). Cuenta **un voto por dispositivo** y se puede quitar.
- Los clientes **no ven cuántos favoritos tiene** cada producto (solo vos, en el panel: lista de productos y tabla del Resumen). Si preferís que lo vean, activá la opción en la pestaña **Reseñas**.
- Cada producto tiene un botón **Compartir** y un **link propio** (por ejemplo `tutienda.com/p/12-ramo-de-3-flores`). En el celular se abre el menú para mandarlo por WhatsApp u otra app; en la compu se puede copiar el link. Quien lo recibe abre directamente ese producto, y al pegarlo en WhatsApp se ve la foto, el nombre y el precio.

## Mayoristas

Al final de la tienda hay una sección **"Trabajá como mayorista"** que lleva a la página `/mayoristas`. Ahí la persona elige si es **emprendimiento** o **negocio** y completa sus datos:

- **Emprendimiento:** nombre del emprendimiento, hace cuánto está en marcha (aproximado), red social (opcional).
- **Negocio:** razón social, nombre de fantasía (opcional), dueño o responsable, CUIT (se valida), condición frente al IVA, rubro, domicilio comercial, hace cuánto está en marcha, si tiene local a la calle, web o Instagram (opcional).
- **En los dos casos:** nombre y apellido, **WhatsApp (obligatorio)**, email (Gmail), ciudad donde vive, cuántas flores piensa comprar por mes (aproximado) y un comentario opcional. El número de WhatsApp se acomoda solo (`0261 15 456 7890` y `+54 9 261 456 7890` quedan iguales).
- La cantidad por mes es solo para que sepas qué tan grande es: **no cambia el trato** y no se rechaza por poner poco o mucho. La página lo aclara.
- Al terminar, le dice que le vas a escribir por WhatsApp para pasarle los **precios de las flores para compras mayores** (compra mínima: 20 flores por mes, la cambiás en el panel) y charlar todo.

En el panel, pestaña **Mayoristas** (con contador y alerta de solicitud nueva):
- **Solicitudes:** ves todos los datos, un botón para escribirle por WhatsApp y otro por email, y **Aceptar comprador** o **Rechazar comprador**. Rechazar borra todo, sin dejar nada.
- **Compradores:** al aceptar, la persona pasa a esta sección (sus datos se guardan comprimidos). Ahí anotás **cuántas flores compró y cuánta plata entró** en cada compra, con fecha. Eso se **suma al Resumen** (Ganancias y "Flores a mayoristas") y lo podés **sacar** cuando quieras: cada compra con "Quitar", o el comprador entero.
- Ajustes: apagar la sección o cambiar la compra mínima.

## Calculadora de costos

Pestaña **Calculadora** del panel. Es solo para tus cuentas: no tiene nada que ver con la tienda y no se ve desde afuera. Arranca vacía.

1. **Agregar materia prima:** nombre, cuánto pagaste y qué trae eso (por ejemplo una cinta de 10 metros, una caja de 100 unidades, un kilo). El sistema te dice cuánto te sale cada centímetro, unidad, gramo o mililitro. Si cambiás el precio, todos los productos se recalculan solos. No deja borrar una materia prima que usa algún producto.
2. **Crear nuevo producto:** le ponés un nombre y le agregás la materia prima que lleva. Cada una la podés medir como:
   - **una cantidad** (centímetros, metros, unidades, gramos, kilos, mililitros, litros),
   - **piezas de cierto largo** (por ejemplo 20 pétalos de 9 cm),
   - **una fracción o porcentaje de lo que compraste:** `1/3`, `1/4`, `1/16`, `25%`, `0,25`, `1 1/2`, o escrito con palabras (`un tercio`, `un cuarto`, `una décima`, `medio`).
3. **Emergencia (opcional):** un porcentaje más o un monto fijo.
4. **Tiempo que tardás en hacerlo** (horas y minutos). En **Ajustes** de la calculadora ponés cuánto querés ganar por hora (en pesos), y en cada producto podés poner otra distinta.
5. El sistema muestra el **precio recomendado**, cuánto es materia prima, emergencia, tu tiempo y ganancia (en pesos y en porcentaje), y la ganancia real por hora. El precio se **redondea hacia arriba** al múltiplo que elijas (por ejemplo de a $100: 1.730 pasa a 1.800 y 1.801 pasa a 1.900).

Ejemplo de la lógica: si los materiales salen $2.000, querés ganar $2.000 por hora y tardás 30 minutos, el precio recomendado es $3.000 ($2.000 de materiales y $1.000 de ganancia).

## Espacio y compresión

En la pestaña **Resumen**, al final, está la tarjeta **Espacio usado**: cuánto ocupa tu base de datos (límite del plan gratis de Supabase: 500 MB) y qué ocupa cada cosa. Qué se comprime y cómo:

- **Fotos:** se reducen y se guardan en formato liviano (WebP), con una miniatura aparte. Una foto de varios MB queda en decenas de KB.
- **Visitas y estadísticas:** los registros de hace más de 90 días se resumen por día, solos, todos los días. Los números del Resumen no cambian. El botón **Comprimir ahora** lo hace en el momento.
- **Compradores mayoristas aceptados:** sus datos se guardan comprimidos (gzip).
- **Pedidos y solicitudes rechazados:** se borran los datos (en los pedidos queda solo el número para el conteo del Resumen).
- Las fotos ya no usadas se limpian solas.

Los datos de texto (pedidos, productos, reseñas) pesan muy poco; lo que más ocupa son las fotos, que ya van comprimidas.

## Vaciar el carrito

Al tocar "Vaciar carrito" aparece una cajita en el medio de la pantalla con **Sí** y **No**.

## Cómo se manda un pedido

En el carrito la clienta completa **nombre y WhatsApp** (obligatorios), cómo lo recibe (envío a domicilio con código postal y dirección, o punto de encuentro) y, si quiere, **para cuándo lo necesita**. Después elige:

- **Mandar pedido:** el pedido se guarda en la pestaña **Pedidos** del panel y le aparece "Tu pedido ya fue mandado, nos comunicamos por WhatsApp para terminar con todo". **Ya no se abre WhatsApp solo**: sos vos quien le escribe desde el panel, con el botón **Escribirle** que trae el pedido.
- **Terminar pedido** (solo aparece si activaste Mercado Pago, ver más abajo): guarda el pedido y la lleva a pagar los productos y, si eligió un correo, el envío. El envío **propio de Mendoza** no va incluido: se coordina aparte por WhatsApp.

Al **rechazar** un pedido en el panel se borran los datos del cliente y del pedido (no se puede deshacer, por eso pide confirmación). El Resumen conserva solo el conteo.

## Aspecto de la tienda

La tienda tiene un diseño parecido a los marketplaces: buscador grande arriba, una barra con las ventajas (envíos, pagos, atención), fondo gris con tarjetas blancas, precio bien visible y descuentos en verde. El color de la marca (**Mi tienda > Color principal**) se usa en el encabezado y los botones; el texto del encabezado se ajusta solo para que se lea. En celular, el carrito tiene los totales siempre visibles abajo.

## Fotos

Todas las fotos se comprimen solas: primero en el navegador y después de nuevo en el servidor. Una foto de celular de varios MB queda en unas decenas de KB, con una miniatura aparte para el catálogo.

## Botón flotante de WhatsApp, buscador y favoritos

- **Botón flotante de WhatsApp:** círculo verde abajo a la derecha en toda la tienda. Usa el número de WhatsApp de **Mi tienda**. Ahí mismo lo podés apagar y cambiar el mensaje que sale escrito.
- **Buscador:** busca por nombre y descripción sin importar mayúsculas ni tildes ("rámo" encuentra "ramo"). Al lado hay un selector de orden (destacados, menor precio, mayor precio, con descuento primero).
- **Favoritos:** además del corazón de cada producto hay un filtro **♥ Favoritos (n)** junto a las categorías.

## Tiempo de anticipación

En el editor de cada producto ponés el **tiempo de anticipación en horas** (0 = sin anticipación; 48 = pedir con 2 días). Los clientes ven en la tarjeta "Pedir con 2 días de anticipación" y en la ficha del producto "Si lo pedís ahora, lo tenés desde el jueves 15/10". En el carrito, el campo **"¿Para cuándo lo necesitás?"** no deja elegir una fecha antes de lo que necesitan los productos del pedido (usa el producto que más anticipación pide). En Pedidos ves "Lo necesita para el dd/mm/aaaa".

## De dónde llegan los clientes

En el **Resumen** hay una tabla **De dónde llegan** (visitas, carritos, pedidos, ventas e ingresos por origen) de los últimos 90 días. Para saber de dónde viene cada persona, usá estos links:

- `tutienda.com/?origen=instagram` (para la bio de Instagram)
- `tutienda.com/?origen=whatsapp` (para el estado o los mensajes)
- `tutienda.com/?origen=facebook`, `?origen=tiktok`, o el nombre que quieras (letras y números)

Si no hay `?origen=`, se detecta solo por la página desde donde llegó (Instagram, Facebook, WhatsApp, Google, TikTok, YouTube) o queda como "directo". Los links que se comparten con el botón Compartir de cada producto quedan como "compartir".

## Notificaciones en el celular (Android)

En la pestaña **Notificaciones** tocá **Activar en este celular** (con Chrome en Android) y aceptá el permiso. A partir de ahí te llega un aviso por cada **pedido nuevo**, **solicitud de mayorista**, **pago confirmado** y **olvido de contraseña**, aunque el panel esté cerrado. Hay un botón para probarlo. Las claves se generan solas la primera vez. **No funciona en iPhone.** Cada celular o computadora se activa por separado, y los que dejan de existir se limpian solos.

## Cuentas de clientes

Las clientas **no necesitan cuenta para comprar**. La cuenta es solo una comodidad: guarda sus datos (se completan solos en el carrito) y muestra "Mis pedidos" con el estado de cada uno (y si fue pagado). En la tienda hay un botón **Ingresar** en el encabezado.

- **Crear cuenta:** con un **usuario** o un **Gmail** y una contraseña de **mínimo 8 caracteres**. Pide nombre y WhatsApp (obligatorio, solo se escribe).
- **Con Google:** usa el mismo ID de cliente de las reseñas (`GOOGLE_CLIENT_ID`). La primera vez pide el WhatsApp.
- Las contraseñas se guardan **cifradas** (nadie, ni vos, puede verlas). Después de 6 intentos fallidos se frena el ingreso 15 minutos.
- **Si alguien creó una cuenta con tu Gmail antes que vos**, al entrar con Google la cuenta pasa a ser tuya y esa contraseña deja de funcionar.

### Olvidé mi contraseña (desde el panel)

1. La clienta toca **Olvidé mi contraseña** y escribe su usuario o email y su WhatsApp. No se le muestra ningún dato de la cuenta.
2. En el panel, pestaña **Cuentas**, te aparece la solicitud (con aviso y contador) mostrando el número que escribió y el que tiene registrado en la cuenta, para que veas si coinciden.
3. Le escribís por WhatsApp para confirmar que es ella. Si es, tocás **Crear contraseña**: la elegís vos o se genera una al azar. Se la pasás por WhatsApp (hay un botón que abre el mensaje ya escrito).
4. Cuando ella entra con esa contraseña temporal, el sistema le pide **crear una nueva** antes de seguir. La temporal deja de servir.
5. Volvés al panel y tocás **Finalizado** (se borra la solicitud). **Rechazar** también la borra, sin crear nada.

### Controlar las cuentas

En **Cuentas** ves cada cuenta con nombre, usuario o email, WhatsApp, **fecha de alta**, **modelo del dispositivo** con el que se creó (por ejemplo "SM-A546E (Android 13) · Chrome"), último ingreso y cantidad de pedidos. Podés **bloquear** (se le cierra la sesión al instante) o **eliminar** (los pedidos quedan en Pedidos). Hay un buscador. *Nota: Chrome en algunos celulares oculta el modelo exacto; en ese caso figura solo "Android".*

## Envíos por correo (Andreani y Correo Argentino)

La clienta elige entre las opciones que cotiza el servidor con su código postal: Andreani a domicilio o a sucursal, y Correo Argentino a domicilio o a sucursal. Cada opción muestra el precio, el plazo (cuando el correo lo informa) y se paga junto con el pedido. El precio **siempre lo calcula el servidor**: lo que mande el navegador se ignora.

**Configuración (una vez, en Render, Environment):**

| Variable | Qué es |
|---|---|
| `ANDREANI_USER`, `ANDREANI_PASS` | usuario y contraseña de tu cuenta de Andreani |
| `ANDREANI_CONTRACT_DOM` | número de contrato para envío a domicilio |
| `ANDREANI_CONTRACT_SUC` | (opcional) contrato para envío a sucursal |
| `ANDREANI_CLIENT` | (opcional) código de cliente |
| `MICORREO_USER`, `MICORREO_PASS` | usuario y contraseña de MiCorreo (Correo Argentino) |
| `MICORREO_CUSTOMER_ID` | tu número de cliente en MiCorreo |

Después, en el panel, **Mi tienda > Envíos por correo**, tildá cada correo que querés ofrecer. Ahí mismo ves si cada uno está **Conectado** o qué variable falta, y podés probar la conexión con un código postal.

**Peso y medidas:** cada producto puede tener su peso (en gramos) y sus medidas de caja (en centímetros), que se cargan al editar el producto. Si no los cargás, se usan los valores por defecto de la pestaña Envíos. Con eso los correos cotizan el paquete real.

**Embalaje:** podés sumar un costo fijo de embalaje a cada envío por correo. Si la clienta tiene un cupón de envío gratis, el correo le sale $0 y el costo lo pagás vos al correo.

**Si un correo no responde**, el cliente igual ve el otro, y el sistema lo avisa. Las cotizaciones se guardan 10 minutos para no consultar a los correos en cada tecla.

**Andreani no informa el plazo al cotizar:** lo escribís vos en "Plazo de Andreani" (por ejemplo "3 a 7 días hábiles"). Correo Argentino sí lo informa.

## Mercado Pago ("Terminar pedido")

Cobra los **productos y el envío por correo** (Andreani o Correo Argentino) en un solo pago. El envío propio de Mendoza no entra en el pago: se coordina por WhatsApp. Para activarlo:

1. En Mercado Pago, sección **Tu negocio > Credenciales** (o *Developers*), copiá el **Access Token**. El de prueba empieza con `TEST-` y el real con `APP_USR-`.
2. En Render, **Environment**, agregá `MP_ACCESS_TOKEN` con ese valor y guardá. **No lo pegues en el chat ni en GitHub.**
3. En el panel, **Mi tienda > Cobro con Mercado Pago**, tildá "Ofrecer Terminar pedido". Ahí ves el estado: *Modo prueba* o *Activo (cuenta real)*.
4. En Mercado Pago, configurá el **aviso de pagos (webhook)** con la dirección que figura en esa misma sección (`https://tu-tienda.onrender.com/api/mp/webhook`).

El botón **Terminar pedido** aparece recién cuando está tildado **y** la clave está puesta. El pago se confirma **solo**, cuando Mercado Pago avisa al servidor (el servidor le pregunta a Mercado Pago si el pago está aprobado y por qué monto; lo que diga el navegador del cliente no cuenta). En Pedidos aparece "✓ Pagado con Mercado Pago" y te llega una notificación. Empezá probando con el token `TEST-` y un usuario de prueba de Mercado Pago antes de cobrar de verdad. Tené en cuenta que Mercado Pago cobra una comisión por venta.

## Que la tienda no se duerma (plan gratis de Render)

Render apaga una tienda gratis cuando pasan 15 minutos sin visitas, y la primera persona que entra después espera unos segundos a que arranque. Además regala **750 horas por mes, compartidas entre todos tus servicios gratis** (un mes de 31 días tiene 744 horas): si tenés otros servicios gratis en la misma cuenta, mantener todo prendido no alcanza.

Se probó la idea de un monitor externo y se descartó. Lo que quedó:

- `KEEP_AWAKE=on` (variable opcional en Render): la tienda se consulta sola cada 10 minutos. **Solo sirve mientras está despierta**: si ya se durmió, no se puede despertar sola. Consume las mismas horas.
- La dirección `/api/health` hace una consulta real a la base de datos y devuelve error (503) si no responde. Sirve para cualquier monitor que quieras usar en el futuro, y mantiene activa la base gratis de Supabase (que se pausa tras más o menos una semana sin uso).
- Si la conexión con la base se corta, la tienda no se cae: se recupera sola cuando vuelve.
- La opción que garantiza que nunca se duerma es un plan pago de Render.

## Datos técnicos

- Node 18 o superior, Express y PostgreSQL. La compresión extra y la imagen de vista previa al compartir usan `sharp` (opcional: si no se pudiera instalar, la tienda funciona igual).
- Los precios, descuentos, cupones y la barra de progreso se calculan en el servidor, así que el total que queda registrado en el panel no se puede alterar desde el navegador.
- Los mapas y distancias usan servicios abiertos y gratuitos (OpenStreetMap / OSRM).
