# GarajeUCB - Backend API

## Descripción

Sistema backend para una plataforma de alquiler de garajes y espacios comerciales entre particulares. Permite a los dueños publicar sus garajes disponibles y a los arrendatarios reservar espacios para comercializar sus productos. Incluye gestión de pagos, chat en tiempo real, verificación de identidad (KYC) y un sistema de soporte con disputas y calificaciones.

## Objetivo General

Proveer una API REST robusta y segura que gestione el ciclo completo de alquiler de garajes: desde el registro y verificación de usuarios hasta la reserva, pago, operación (check-in/check-out), finanzas y soporte.

## Objetivos Específicos

- Implementar una API REST con más de 25 endpoints funcionales organizados en módulos.
- Persistir datos en PostgreSQL utilizando Prisma ORM con más de 20 modelos relacionales.
- Implementar autenticación JWT con verificación KYC obligatoria y soporte para inicio de sesión de Google (Firebase).
- Integrar chat en tiempo real con Socket.io y almacenamiento de adjuntos en Cloudflare R2.
- Implementar sistema financiero con billetera virtual, retenciones y retiros.
- Documentar la API automáticamente con Swagger/OpenAPI en la ruta designada.

## Alcance

**Secciones Incluidas:**
- CRUD de usuarios con registro, login, autenticación con Google y verificación KYC.
- Gestión completa de garajes (horarios semanales, servicios adicionales, imágenes, fechas bloqueadas).
- Búsqueda de garajes disponibles por fecha y horario.
- Sistema de reservas con fechas, categorías y servicios adicionales.
- Procesamiento de pagos con verificación de comprobante.
- Operaciones de check-in y check-out con evidencias fotográficas estructuradas.
- Billetera virtual con control de saldo disponible y retenido, con operaciones de retiro financiero.
- Chat bidireccional en tiempo real con historial y gestión de imágenes adjuntas.
- Sistema integral de soporte, gestión de tickets y calificaciones.
- Panel de control administrativo para aprobación de retiros y documentación KYC.

## Stack Tecnológico

| Tecnología | Rol Arquitectónico |
|---|---|
| Node.js + Express 5 | Servidor HTTP y enrutamiento REST API |
| PostgreSQL | Proveedor de base de datos relacional |
| Prisma 5 | Mapeo Objeto-Relacional y migraciones estructurales |
| JWT + bcryptjs | Sistema de encriptación y tokens de acceso de sesión |
| Firebase Admin SDK | Verificación de identidad delegada por Google Auth |
| Socket.io | Infraestructura de comunicación en tiempo real |
| Cloudflare R2 + AWS S3 SDK | Bucket de almacenamiento de objetos estáticos seguro |
| Swagger UI Express | Estandarización y documentación de endpoints |

## Arquitectura del Sistema

```text
Cliente (Plataforma Móvil)
        │
        ▼
   Servidor REST API (Express) ◄──► WebSockets (Socket.io)
        │
        ▼
  Capa de Persistencia (Prisma ORM ── PostgreSQL)
        │
        ▼
  Servicios Externos (Cloudflare R2 Bucket)
```

**Flujo Operativo Estándar:**
1. Registro de identidad (incluyendo proceso de seguridad KYC).
2. Proceso de validación a nivel administrativo central.
3. El arrendador publica oferta; el arrendatario interactúa vía motor de búsqueda.
4. Generación de contrato transaccional (reserva) y confirmación de pago.
5. Ejecución del período contractual con registros fotográficos obligatorios (check-in / check-out).
6. Liquidación de obligaciones financieras desde saldo retenido a saldo disponible del arrendador.
7. Opciones de retiro de capital para los arrendadores.
8. Evaluación bilateral de calidad del servicio post-transacción.

## Entorno de Ejecución

1. **Clonar repositorio y dependencias**
   ```bash
   git clone [url-del-repositorio]
   cd backend_garajes
   npm install
   ```

2. **Inicializar esquema de base de datos**
   ```bash
   npx prisma migrate deploy
   npx prisma generate
   ```

3. **Ejecución en Entorno Local**
   ```bash
   npm run dev
   ```

El proyecto se basa en la definición de variables de entorno estándar especificadas en la plantilla `.env.example`.

## Equipo de Integración

- **Gabriel Mamani**: Arquitectura Backend
