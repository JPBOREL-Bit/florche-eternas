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

---

## Qué hay en el panel (`/admin`)

**Resumen** – Visitantes, carritos creados, pedidos enviados a WhatsApp, ventas realizadas, rechazadas, pendientes y **Ganancias**. Podés ver Hoy, 7 días, 30 días o Todo. Incluye el recorrido de la venta (entraron → vieron un producto → agregaron al carrito → enviaron pedido → venta realizada), gráficos por día y una tabla por producto (cuánta gente lo vio, cuántos lo agregaron al carrito y cuánto vendió).
Tus propias visitas desde el panel no se cuentan.

**Pedidos** – Cada vez que un cliente toca "Enviar pedido por WhatsApp" queda registrado acá y, si tenés el panel abierto, aparece una **alerta** (con el nombre y el total) y un contador en la pestaña. Marcás cada pedido como **Venta realizada** (suma a Ganancias) o **Venta rechazada**. Podés volver a ponerlo en pendiente o borrarlo.
> La alerta funciona con el panel abierto en el navegador. Cuando no lo tenés abierto, el pedido igual te llega por WhatsApp y lo ves en Pedidos al entrar.

**Productos** – Fijar arriba del catálogo, ponerles **descuento** (porcentaje o monto fijo, con fecha de vencimiento opcional), opciones con precio, fotos.

**Cupones** – Los creás vos: nombre, porcentaje o monto en pesos (o envío gratis), compra mínima, descuento máximo (tope), productos a los que aplica, vencimiento, cantidad de usos y activar/desactivar. Ejemplos: "50% en productos elegidos" o "$4.000 de descuento comprando más de $20.000". El cliente lo escribe al final del carrito (es opcional).

**Promos** – Mensajes que rotan en la barra de arriba (uno por línea) y la **barra de progreso** del carrito: definís niveles por monto (envío gratis, descuento % o $, o un regalo) y se desbloquean solos a medida que el cliente suma plata.

**Envíos** – Tu código postal, precio por km y mínimo. El sistema busca solo los km (solo Mendoza). El envío es **solo orientativo**: se muestra al cliente pero no se suma al total ni va en el mensaje de WhatsApp.

**Mi tienda** – Nombre, textos, WhatsApp, color, logo y **banner de portada** (conviene una foto horizontal, por ejemplo 1600×600; se muestra completa). El botón "Optimizar fotos ya subidas" comprime las fotos que subiste antes.

## El mensaje de WhatsApp

Lleva solo el saludo con el nombre y el pedido (con las opciones elegidas y aclaraciones), sin emojis y sin envío. Si hubo descuentos o cupón, se agregan líneas con el subtotal, el descuento y el total final.

## Fotos

Todas las fotos se comprimen solas: primero en el navegador y después de nuevo en el servidor. Una foto de celular de varios MB queda en unas decenas de KB, con una miniatura aparte para el catálogo.

## Datos técnicos

- Node 18 o superior, Express y PostgreSQL. La compresión extra usa `sharp` (opcional: si no se pudiera instalar, la tienda funciona igual).
- Los precios, descuentos, cupones y la barra de progreso se calculan en el servidor, así que el total que queda registrado en el panel no se puede alterar desde el navegador.
- Los mapas y distancias usan servicios abiertos y gratuitos (OpenStreetMap / OSRM).
