# Garajes Backend API

## Descripción
Sistema backend para una plataforma de alquiler de garajes/espacios comerciales entre particulares. Permite a los dueños publicar sus garajes disponibles y a los vendedores ambulantes reservar espacios para vender sus productos, incluyendo gestión de pagos, chat en tiempo real, verificación KYC y sistema de soporte con disputas.

## Objetivo general
- Proveer una API REST robusta y segura que gestione el ciclo completo de alquiler de garajes: desde el registro y verificación de usuarios, hasta la reserva, pago, operación (check-in/check-out), finanzas y soporte.

## Objetivos específicos (medibles)
- Implementar una API REST con +25 endpoints funcionales organizados en 8 módulos.
- Persistir datos en PostgreSQL usando Prisma ORM con 20+ modelos relacionales.
- Implementar autenticación JWT con verificación KYC obligatoria.
- Integrar chat en tiempo real con Socket.io y almacenamiento de adjuntos en Cloudflare R2.
- Implementar sistema financiero con billetera virtual, retenciones y retiros.
- Documentar la API automáticamente con Swagger/OpenAPI.

## Alcance (qué incluye / qué NO incluye)

**Incluye:**
- CRUD de usuarios con registro, login y verificación KYC
- Gestión completa de garajes (crear, horarios, servicios, imágenes, fechas bloqueadas)
- Búsqueda de garajes disponibles por fecha y horario
- Sistema de reservas con fechas, categorías y servicios extra
- Procesamiento de pagos con comprobantes (QR o tarjeta)
- Operaciones de check-in y check-out con evidencias fotográficas
- Billetera virtual con saldo disponible, saldo retenido, retiros y comisiones
- Chat en tiempo real (Socket.io) con historial persistido y adjuntos de imagen
- Sistema de soporte: disputas, tickets y calificaciones
- Panel administrativo (aprobar usuarios, resolver tickets, aprobar retiros)
- Documentación Swagger en `/api-docs`

**No incluye (por ahora):**
- Frontend / interfaz de usuario
- Notificaciones push
- Pasarela de pago externa (Stripe, PayPal, etc.)
- Roles avanzados más allá de usuario/admin
- Deploy automatizado (CI/CD)

## Stack tecnológico
- **Backend:** Node.js + Express 5
- **Base de datos:** PostgreSQL
- **ORM:** Prisma 5
- **Autenticación:** JSON Web Tokens (jsonwebtoken) + bcryptjs
- **Tiempo Real:** Socket.io
- **Almacenamiento de archivos:** Cloudflare R2 (AWS S3 SDK compatible)
- **Documentación:** Swagger (swagger-jsdoc + swagger-ui-express)
- **Seguridad:** Helmet + CORS + express-rate-limit
- **Upload de archivos:** Multer
- **Testing:** Postman
- **Control de versiones:** Git + GitHub

## Arquitectura (resumen simple)
```
Cliente (Frontend/Mobile)
        │
        ▼
   API REST (Express)  ◄──►  Socket.io (Chat en tiempo real)
        │
        ▼
  Prisma ORM (PostgreSQL)
        │
        ▼
  Cloudflare R2 (Imágenes KYC, garajes, chat)
```

**Flujo principal del sistema:**
1. El usuario se registra y sube documentos KYC (foto DNI + selfie).
2. Un administrador aprueba la verificación KYC del usuario.
3. El usuario verificado puede crear garajes (modo arrendatario) o buscar garajes disponibles (modo vendedor).
4. El vendedor crea una reserva, selecciona fechas/horarios y paga.
5. El día de la reserva se realiza check-in y check-out con evidencias fotográficas.
6. Al completar el check-out, los fondos retenidos se liberan a la billetera del dueño.
7. El dueño puede solicitar retiros a su cuenta bancaria.
8. Ambas partes pueden chatear en tiempo real y calificarse mutuamente.

## Entidades principales (modelos de datos)

| Modelo | Campos clave |
|---|---|
| `Usuario` | id, correo, password, nombre_completo, esta_verificado, es_admin, modo_actual |
| `Garaje` | id, id_dueno, nombre, direccion, lat/lng, precio_hora, precio_dia, capacidad, amenidades |
| `HorarioSemanal` | id, id_garaje, dia_semana, abierto, hora_inicio, hora_fin |
| `Reserva` | id, id_garaje, id_vendedor, estado, tipo_cobro, precio_total, comision_app |
| `FechaReserva` | id, id_reserva, fecha, hora_inicio, hora_fin, estado, check-in/check-out real |
| `ComprobantePago` | id, id_reserva, metodo (QR/TARJETA), estado |
| `Mensaje` | id, id_reserva, id_emisor, contenido, adjuntos |
| `Billetera` | id, id_usuario, saldo_disponible, saldo_retenido |
| `TicketSoporte` | id, id_reserva, id_reportador, tipo_problema, estado, resolucion_admin |
| `Calificacion` | id, id_reserva, id_autor, id_objetivo, puntuacion, comentario |

## Endpoints core (priorizados)

### 1. Usuarios (`/api/users`)
| Método | Endpoint | Descripción |
|---|---|---|
| `POST` | `/api/users/register` | Registrar nuevo usuario |
| `POST` | `/api/users/login` | Iniciar sesión (devuelve JWT) |
| `POST` | `/api/users/kyc` | Subir documentos KYC (DNI + selfie) |
| `GET` | `/api/users/kyc/:idUsuario` | Ver documentos KYC (solo admin) |
| `POST` | `/api/users/approve/:idUsuario` | Aprobar usuario verificado (solo admin) |

### 2. Garajes (`/api/garages`)
| Método | Endpoint | Descripción |
|---|---|---|
| `POST` | `/api/garages` | Crear un garaje |
| `POST` | `/api/garages/:idGaraje/horarios` | Agregar horario semanal |
| `POST` | `/api/garages/:idGaraje/servicios` | Agregar servicio adicional |
| `POST` | `/api/garages/:idGaraje/bloquear-fecha` | Bloquear fecha específica |
| `POST` | `/api/garages/:idGaraje/imagenes` | Subir imagen del garaje |

### 3. Búsqueda (`/api/search`)
| Método | Endpoint | Descripción |
|---|---|---|
| `GET` | `/api/search?fecha=YYYY-MM-DD&hora_inicio=HH:mm&hora_fin=HH:mm` | Buscar garajes disponibles |

### 4. Reservas (`/api/reservations`)
| Método | Endpoint | Descripción |
|---|---|---|
| `POST` | `/api/reservations` | Crear reserva |
| `POST` | `/api/reservations/:idReserva/pagar` | Pagar reserva |

### 5. Operaciones (`/api/operations`)
| Método | Endpoint | Descripción |
|---|---|---|
| `POST` | `/api/operations/:idReserva/check-in` | Registrar check-in |
| `POST` | `/api/operations/:idReserva/check-out` | Registrar check-out y liberar fondos |

### 6. Finanzas (`/api/finances`)
| Método | Endpoint | Descripción |
|---|---|---|
| `GET` | `/api/finances/billetera` | Consultar saldo de billetera |
| `POST` | `/api/finances/billetera/retiros` | Solicitar retiro a cuenta bancaria |
| `POST` | `/api/finances/billetera/retiros/:idSolicitud/aprobar` | Aprobar retiro (solo admin) |

### 7. Soporte (`/api/support`)
| Método | Endpoint | Descripción |
|---|---|---|
| `POST` | `/api/support/reservas/:idReserva/disputa` | Reportar problema/disputa |
| `POST` | `/api/support/tickets/:idTicket/resolver` | Resolver ticket (solo admin) |
| `POST` | `/api/support/reservas/:idReserva/calificar` | Calificar experiencia |

### 8. Chat (`/api/chat` + Socket.io)
| Método | Endpoint | Descripción |
|---|---|---|
| `GET` | `/api/chat/:idReserva/mensajes` | Obtener historial de mensajes |
| `POST` | `/api/chat/presigned-url` | Generar URL firmada para subir imagen |
| `GET` | `/api/chat/adjunto/:key` | Obtener URL temporal de lectura de adjunto |

**Eventos Socket.io:**
| Evento | Dirección | Descripción |
|---|---|---|
| `join_room` | Cliente → Servidor | Unirse al room de una reserva |
| `send_message` | Cliente → Servidor | Enviar mensaje de texto o con adjunto |
| `receive_message` | Servidor → Cliente | Recibir mensaje en tiempo real |
| `leave_room` | Cliente → Servidor | Salir del room |

## Cómo ejecutar el proyecto (local)

1. **Clonar repositorio**
   ```bash
   git clone <URL>
   cd backend_garajes
   ```

2. **Instalar dependencias**
   ```bash
   npm install
   ```

3. **Configurar variables de entorno**
   ```bash
   cp .env.example .env
   # Editar .env con tus credenciales
   ```

4. **Configurar base de datos**
   ```bash
   npx prisma migrate deploy
   npx prisma generate
   ```

5. **Ejecutar servidor en modo desarrollo**
   ```bash
   npm run dev
   ```

6. **Acceder a la documentación Swagger**
   ```
   http://localhost:3000/api-docs
   ```

7. **Verificar que el servidor funciona**
   ```
   GET http://localhost:3000/health
   ```

## Variables de entorno (ejemplo)
```env
# Base de datos PostgreSQL
DATABASE_URL=postgresql://postgres:tu_password@localhost:5432/garajes_db?schema=public
PORT=3000

# Cloudflare R2 (Storage de archivos)
R2_ACCOUNT_ID=tu_account_id_cloudflare
R2_ACCESS_KEY_ID=tu_access_key_id
R2_SECRET_ACCESS_KEY=tu_secret_access_key

# Bucket público (imágenes de garajes, perfiles, chat)
R2_BUCKET_PUBLIC=garajes
R2_PUBLIC_URL=https://pub-tudominio-r2.dev

# Bucket privado (documentos KYC)
R2_BUCKET_PRIVATE=garajes-kyc

# URL del frontend (para CORS)
FRONTEND_URL=https://tu-dominio-frontend.com
```

## Estructura del proyecto
```
backend_garajes/
  src/
    app.js                     # Configuración de Express (middlewares, rutas, CORS, Swagger)
    index.js                   # Arranque del servidor HTTP + Socket.io
    swagger.config.js          # Configuración de Swagger/OpenAPI
    routes/
      user.routes.js           # Endpoints de usuarios (registro, login, KYC)
      garage.routes.js         # Endpoints de garajes (crear, horarios, servicios, imágenes)
      search.routes.js         # Endpoint de búsqueda de garajes disponibles
      reservation.routes.js    # Endpoints de reservas (crear, pagar)
      operation.routes.js      # Endpoints de operaciones (check-in, check-out)
      finance.routes.js        # Endpoints de finanzas (billetera, retiros)
      support.routes.js        # Endpoints de soporte (disputas, tickets, calificaciones)
      chat.routes.js           # Endpoints REST del chat (historial, presigned URLs)
    controllers/
      user.controller.js       # Lógica de registro, login, KYC y aprobación
      garage.controller.js     # Lógica de gestión de garajes
      search.controller.js     # Lógica de búsqueda con filtros
      reservation.controller.js # Lógica de reservas y pagos
      operation.controller.js  # Lógica de check-in/check-out con evidencias
      finance.controller.js    # Lógica de billetera y retiros
      support.controller.js    # Lógica de disputas y calificaciones
      chat.controller.js       # Lógica REST del chat
    services/
      upload.service.js        # Servicio de subida de archivos a Cloudflare R2
    socket/
      chat.gateway.js          # Gateway de Socket.io (conexión, rooms, mensajes en tiempo real)
    middlewares/
      auth.middleware.js       # Autenticación JWT, verificación KYC, verificación admin
      error.middleware.js      # Manejo centralizado de errores
      upload.middleware.js     # Configuración de Multer para uploads
    db/
      prisma.js                # Instancia del cliente Prisma
    config/
      supabase.js              # Configuración de Supabase (referencia)
  prisma/
    schema.prisma              # Esquema de base de datos (20+ modelos)
    migrations/                # Migraciones de Prisma
  .env.example                 # Plantilla de variables de entorno
  package.json
  README.md
```

**Explicación del flujo:** Routes recibe la petición HTTP, el controller decide qué hacer y aplica la lógica del negocio, el service maneja operaciones externas (ej: Cloudflare R2), y Prisma se encarga de guardar o leer los datos en PostgreSQL.

## Ejemplos de Endpoints

### Endpoint 1 — Registrar usuario
```http
POST /api/users/register
Content-Type: application/json
```
**Body (JSON):**
```json
{
  "correo": "vendedor@ejemplo.com",
  "password": "miPassword123",
  "nombre_completo": "Juan Pérez"
}
```
**Resultado:** Devuelve el usuario creado con su token JWT.
**Explicación:** Crea un nuevo registro de usuario con password hasheado (bcrypt).

---

### Endpoint 2 — Buscar garajes disponibles
```http
GET /api/search?fecha=2026-03-15&hora_inicio=10:00&hora_fin=14:00
Authorization: Bearer <token>
```
**Resultado:** Devuelve un arreglo con los garajes disponibles en esa fecha y horario.
**Explicación:** Consulta la base de datos filtrando por disponibilidad, horarios semanales y fechas bloqueadas.

---

### Endpoint 3 — Crear una reserva
```http
POST /api/reservations
Authorization: Bearer <token>
Content-Type: application/json
```
**Body (JSON):**
```json
{
  "id_garaje": "uuid-del-garaje",
  "tipo_cobro": "POR_HORA",
  "mensaje_inicial": "Necesito el espacio para vender artesanías",
  "fechas": [
    {
      "fecha": "2026-03-15",
      "hora_inicio": "10:00",
      "hora_fin": "14:00"
    }
  ],
  "categorias": [1, 3],
  "acepto_terminos_responsabilidad": true
}
```
**Resultado:** Devuelve la reserva creada con su precio calculado, comisión y desglose.
**Explicación:** Crea la reserva, calcula el precio total y retiene los fondos en la billetera del dueño.

## Equipo y roles
- Nombre 1: Backend
- Nombre 2: Frontend
- Nombre 3: DevOps / QA
