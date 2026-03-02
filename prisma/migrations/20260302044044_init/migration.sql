-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL,
    "correo" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "nombre_completo" TEXT,
    "dni_foto_url" TEXT,
    "selfie_url" TEXT,
    "esta_verificado" BOOLEAN NOT NULL DEFAULT false,
    "url_foto_perfil" TEXT,
    "modo_actual" TEXT NOT NULL DEFAULT 'VENDEDOR',
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_actualizacion" TIMESTAMP(3) NOT NULL,
    "fecha_eliminacion" TIMESTAMP(3),

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Garaje" (
    "id" TEXT NOT NULL,
    "id_dueno" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "direccion" TEXT,
    "latitud" DOUBLE PRECISION,
    "longitud" DOUBLE PRECISION,
    "precio_hora" DECIMAL(10,2),
    "precio_dia" DECIMAL(10,2),
    "minimo_horas" INTEGER NOT NULL DEFAULT 1,
    "tiempo_limpieza" INTEGER NOT NULL DEFAULT 0,
    "tiene_wifi" BOOLEAN NOT NULL DEFAULT false,
    "tiene_bano" BOOLEAN NOT NULL DEFAULT false,
    "tiene_electricidad" BOOLEAN NOT NULL DEFAULT false,
    "tiene_mesa" BOOLEAN NOT NULL DEFAULT false,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_actualizacion" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Garaje_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImagenGaraje" (
    "id" TEXT NOT NULL,
    "id_garaje" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImagenGaraje_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HorarioSemanal" (
    "id" TEXT NOT NULL,
    "id_garaje" TEXT NOT NULL,
    "dia_semana" INTEGER NOT NULL,
    "abierto" BOOLEAN NOT NULL DEFAULT true,
    "hora_inicio" TEXT NOT NULL DEFAULT '08:00',
    "hora_fin" TEXT NOT NULL DEFAULT '20:00',

    CONSTRAINT "HorarioSemanal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FechaBloqueada" (
    "id" TEXT NOT NULL,
    "id_garaje" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "motivo" TEXT,

    CONSTRAINT "FechaBloqueada_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServicioAdicional" (
    "id" TEXT NOT NULL,
    "id_garaje" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "precio" DECIMAL(10,2) NOT NULL,
    "es_por_dia" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ServicioAdicional_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CategoriaProducto" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,

    CONSTRAINT "CategoriaProducto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reserva" (
    "id" TEXT NOT NULL,
    "id_garaje" TEXT NOT NULL,
    "id_vendedor" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "tipo_cobro" TEXT,
    "precio_total" DECIMAL(10,2),
    "comision_app" DECIMAL(10,2),
    "monto_dueno" DECIMAL(10,2),
    "mensaje_inicial" TEXT,
    "acepto_terminos_responsabilidad" BOOLEAN NOT NULL DEFAULT false,
    "version_terminos" TEXT,
    "ip_aceptacion" TEXT,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_actualizacion" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reserva_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FechaReserva" (
    "id" TEXT NOT NULL,
    "id_reserva" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "hora_inicio" TEXT NOT NULL,
    "hora_fin" TEXT NOT NULL,
    "hora_checkin_real" TIMESTAMP(3),
    "hora_checkout_real" TIMESTAMP(3),
    "estado" TEXT NOT NULL DEFAULT 'PROGRAMADA',

    CONSTRAINT "FechaReserva_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvidenciaReserva" (
    "id" TEXT NOT NULL,
    "id_fecha_reserva" TEXT NOT NULL,
    "tipo_momento" TEXT NOT NULL,
    "url_foto" TEXT NOT NULL,
    "comentarios" TEXT,
    "fecha_subida" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvidenciaReserva_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReservaCategoria" (
    "id_reserva" TEXT NOT NULL,
    "id_categoria" INTEGER NOT NULL,

    CONSTRAINT "ReservaCategoria_pkey" PRIMARY KEY ("id_reserva","id_categoria")
);

-- CreateTable
CREATE TABLE "ReservaServicioExtra" (
    "id_reserva" TEXT NOT NULL,
    "id_servicio" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL DEFAULT 1,
    "precio_acordado" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "ReservaServicioExtra_pkey" PRIMARY KEY ("id_reserva","id_servicio")
);

-- CreateTable
CREATE TABLE "SolicitudCambioReserva" (
    "id" TEXT NOT NULL,
    "id_reserva" TEXT NOT NULL,
    "solicitado_por_id" TEXT NOT NULL,
    "nuevo_precio" DECIMAL(10,2),
    "motivo" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SolicitudCambioReserva_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComprobantePago" (
    "id" TEXT NOT NULL,
    "id_reserva" TEXT NOT NULL,
    "metodo" TEXT NOT NULL,
    "url_imagen" TEXT,
    "id_transaccion" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'EN_REVISION',
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ComprobantePago_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Mensaje" (
    "id" TEXT NOT NULL,
    "id_reserva" TEXT NOT NULL,
    "id_emisor" TEXT NOT NULL,
    "contenido" TEXT NOT NULL,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Mensaje_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdjuntoMensaje" (
    "id" TEXT NOT NULL,
    "id_mensaje" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'IMAGEN',

    CONSTRAINT "AdjuntoMensaje_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Calificacion" (
    "id" TEXT NOT NULL,
    "id_reserva" TEXT NOT NULL,
    "id_autor" TEXT NOT NULL,
    "id_objetivo" TEXT NOT NULL,
    "tipo_objetivo" TEXT,
    "puntuacion" INTEGER NOT NULL,
    "comentario" TEXT,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Calificacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Billetera" (
    "id" TEXT NOT NULL,
    "id_usuario" TEXT NOT NULL,
    "saldo_disponible" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "saldo_retenido" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "fecha_actualizacion" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Billetera_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MovimientoBilletera" (
    "id" TEXT NOT NULL,
    "id_billetera" TEXT NOT NULL,
    "id_reserva" TEXT,
    "tipo" TEXT NOT NULL,
    "monto" DECIMAL(10,2) NOT NULL,
    "descripcion" TEXT,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MovimientoBilletera_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SolicitudRetiro" (
    "id" TEXT NOT NULL,
    "id_usuario" TEXT NOT NULL,
    "monto" DECIMAL(10,2) NOT NULL,
    "banco_destino" TEXT,
    "cuenta_destino" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "url_comprobante" TEXT,
    "fecha_solicitud" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_procesado" TIMESTAMP(3),

    CONSTRAINT "SolicitudRetiro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketSoporte" (
    "id" TEXT NOT NULL,
    "id_reserva" TEXT NOT NULL,
    "id_reportador" TEXT NOT NULL,
    "tipo_problema" TEXT,
    "descripcion_urgente" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'ABIERTO',
    "resolucion_admin" TEXT,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_cierre" TIMESTAMP(3),

    CONSTRAINT "TicketSoporte_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConfiguracionPlataforma" (
    "id" SERIAL NOT NULL,
    "clave" TEXT NOT NULL,
    "valor" TEXT NOT NULL,
    "descripcion" TEXT,
    "fecha_actualizacion" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConfiguracionPlataforma_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notificacion" (
    "id" TEXT NOT NULL,
    "id_usuario" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "cuerpo" TEXT,
    "leido" BOOLEAN NOT NULL DEFAULT false,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notificacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LogAuditoria" (
    "id" TEXT NOT NULL,
    "id_usuario" TEXT NOT NULL,
    "accion" TEXT NOT NULL,
    "entidad" TEXT NOT NULL,
    "id_entidad" TEXT NOT NULL,
    "datos_previos" JSONB,
    "datos_nuevos" JSONB,
    "ip_conexion" TEXT,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LogAuditoria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_correo_key" ON "Usuario"("correo");

-- CreateIndex
CREATE UNIQUE INDEX "ComprobantePago_id_reserva_key" ON "ComprobantePago"("id_reserva");

-- CreateIndex
CREATE UNIQUE INDEX "Billetera_id_usuario_key" ON "Billetera"("id_usuario");

-- CreateIndex
CREATE UNIQUE INDEX "ConfiguracionPlataforma_clave_key" ON "ConfiguracionPlataforma"("clave");

-- AddForeignKey
ALTER TABLE "Garaje" ADD CONSTRAINT "Garaje_id_dueno_fkey" FOREIGN KEY ("id_dueno") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImagenGaraje" ADD CONSTRAINT "ImagenGaraje_id_garaje_fkey" FOREIGN KEY ("id_garaje") REFERENCES "Garaje"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HorarioSemanal" ADD CONSTRAINT "HorarioSemanal_id_garaje_fkey" FOREIGN KEY ("id_garaje") REFERENCES "Garaje"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FechaBloqueada" ADD CONSTRAINT "FechaBloqueada_id_garaje_fkey" FOREIGN KEY ("id_garaje") REFERENCES "Garaje"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServicioAdicional" ADD CONSTRAINT "ServicioAdicional_id_garaje_fkey" FOREIGN KEY ("id_garaje") REFERENCES "Garaje"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reserva" ADD CONSTRAINT "Reserva_id_garaje_fkey" FOREIGN KEY ("id_garaje") REFERENCES "Garaje"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reserva" ADD CONSTRAINT "Reserva_id_vendedor_fkey" FOREIGN KEY ("id_vendedor") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FechaReserva" ADD CONSTRAINT "FechaReserva_id_reserva_fkey" FOREIGN KEY ("id_reserva") REFERENCES "Reserva"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenciaReserva" ADD CONSTRAINT "EvidenciaReserva_id_fecha_reserva_fkey" FOREIGN KEY ("id_fecha_reserva") REFERENCES "FechaReserva"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReservaCategoria" ADD CONSTRAINT "ReservaCategoria_id_reserva_fkey" FOREIGN KEY ("id_reserva") REFERENCES "Reserva"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReservaCategoria" ADD CONSTRAINT "ReservaCategoria_id_categoria_fkey" FOREIGN KEY ("id_categoria") REFERENCES "CategoriaProducto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReservaServicioExtra" ADD CONSTRAINT "ReservaServicioExtra_id_reserva_fkey" FOREIGN KEY ("id_reserva") REFERENCES "Reserva"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReservaServicioExtra" ADD CONSTRAINT "ReservaServicioExtra_id_servicio_fkey" FOREIGN KEY ("id_servicio") REFERENCES "ServicioAdicional"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolicitudCambioReserva" ADD CONSTRAINT "SolicitudCambioReserva_id_reserva_fkey" FOREIGN KEY ("id_reserva") REFERENCES "Reserva"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComprobantePago" ADD CONSTRAINT "ComprobantePago_id_reserva_fkey" FOREIGN KEY ("id_reserva") REFERENCES "Reserva"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mensaje" ADD CONSTRAINT "Mensaje_id_reserva_fkey" FOREIGN KEY ("id_reserva") REFERENCES "Reserva"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mensaje" ADD CONSTRAINT "Mensaje_id_emisor_fkey" FOREIGN KEY ("id_emisor") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdjuntoMensaje" ADD CONSTRAINT "AdjuntoMensaje_id_mensaje_fkey" FOREIGN KEY ("id_mensaje") REFERENCES "Mensaje"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Calificacion" ADD CONSTRAINT "Calificacion_id_reserva_fkey" FOREIGN KEY ("id_reserva") REFERENCES "Reserva"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Calificacion" ADD CONSTRAINT "Calificacion_id_autor_fkey" FOREIGN KEY ("id_autor") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Calificacion" ADD CONSTRAINT "Calificacion_id_objetivo_fkey" FOREIGN KEY ("id_objetivo") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Billetera" ADD CONSTRAINT "Billetera_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoBilletera" ADD CONSTRAINT "MovimientoBilletera_id_billetera_fkey" FOREIGN KEY ("id_billetera") REFERENCES "Billetera"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoBilletera" ADD CONSTRAINT "MovimientoBilletera_id_reserva_fkey" FOREIGN KEY ("id_reserva") REFERENCES "Reserva"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolicitudRetiro" ADD CONSTRAINT "SolicitudRetiro_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketSoporte" ADD CONSTRAINT "TicketSoporte_id_reserva_fkey" FOREIGN KEY ("id_reserva") REFERENCES "Reserva"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketSoporte" ADD CONSTRAINT "TicketSoporte_id_reportador_fkey" FOREIGN KEY ("id_reportador") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notificacion" ADD CONSTRAINT "Notificacion_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LogAuditoria" ADD CONSTRAINT "LogAuditoria_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
