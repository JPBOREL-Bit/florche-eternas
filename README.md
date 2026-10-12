# Florche.Eternas – Tienda online

Tienda de flores de cinta de raso con panel de administración.
El cliente arma su pedido, cotiza el envío con su código postal y el pedido te llega por WhatsApp.

- Tienda: `https://TU-APP.onrender.com/`
- Panel: `https://TU-APP.onrender.com/admin`

---

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
| `GOOGLE_CLIENT_ID` | para las reseñas (ver sección **Reseñas**). Podés agregarla más tarde |

---

## Qué hay en el panel (`/admin`)

**Resumen** – Visitantes, carritos creados, pedidos enviados a WhatsApp, ventas realizadas, rechazadas, pendientes y **Ganancias**. Podés ver Hoy, 7 días, 30 días o Todo. Incluye el recorrido de la venta (entraron → vieron un producto → agregaron al carrito → enviaron pedido → venta realizada), gráficos por día y una tabla por producto (cuánta gente lo vio, cuántos lo agregaron al carrito y cuánto vendió).
Tus propias visitas desde el panel no se cuentan.

**Pedidos** – Cada vez que un cliente toca "Enviar pedido por WhatsApp" queda registrado acá y, si tenés el panel abierto, aparece una **alerta** (con el nombre y el total) y un contador en la pestaña. Marcás cada pedido como **Venta realizada** (suma a Ganancias) o **Venta rechazada**. Podés volver a ponerlo en pendiente o borrarlo.
> La alerta funciona con el panel abierto en el navegador. Cuando no lo tenés abierto, el pedido igual te llega por WhatsApp y lo ves en Pedidos al entrar.
Al **rechazar** un pedido se borran los datos del cliente y del pedido (sin vuelta atrás; el Resumen conserva solo el conteo), por eso pide confirmación.

**Mayoristas** – Solicitudes de compradores por mayor, compradores aceptados y sus compras (ver sección **Mayoristas**).

**Calculadora** – Tus costos: materia prima, productos con receta, tiempo y precio recomendado (ver sección **Calculadora de costos**).

**Productos** – Fijar arriba del catálogo, ponerles **descuento** (porcentaje o monto fijo, con fecha de vencimiento opcional), opciones con precio, fotos.

**Cupones** – Los creás vos: nombre, porcentaje o monto en pesos (o envío gratis), compra mínima, descuento máximo (tope), productos a los que aplica, vencimiento, cantidad de usos y activar/desactivar. Ejemplos: "50% en productos elegidos" o "$4.000 de descuento comprando más de $20.000". El cliente lo escribe al final del carrito (es opcional).

**Promos** – Mensajes que rotan en la barra de arriba (uno por línea) y la **barra de progreso** del carrito: definís niveles por monto (envío gratis, descuento % o $, o un regalo) y se desbloquean solos a medida que el cliente suma plata.

**Envíos** – Tu código postal, precio por km y mínimo. El sistema busca solo los km (solo Mendoza). El envío es **solo orientativo**: se muestra al cliente pero no se suma al total ni va en el mensaje de WhatsApp.

**Mi tienda** – Nombre, textos, WhatsApp, color, logo y **banner de portada** (conviene una foto horizontal, por ejemplo 1600×600; se muestra completa). El botón "Optimizar fotos ya subidas" comprime las fotos que subiste antes.

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

## El mensaje de WhatsApp

Lleva solo el saludo con el nombre y el pedido (con las opciones elegidas y aclaraciones), sin emojis y sin envío. Si hubo descuentos o cupón, se agregan líneas con el subtotal, el descuento y el total final.

## Fotos

Todas las fotos se comprimen solas: primero en el navegador y después de nuevo en el servidor. Una foto de celular de varios MB queda en unas decenas de KB, con una miniatura aparte para el catálogo.

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
