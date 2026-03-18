const prisma = require('../db/prisma');

/**
 * 1. Motor de Búsqueda de Garajes
 * El vendedor busca un garaje pasándole Fecha, Hora Inicio y Hora Fin.
 */
const searchGarajes = async (req, res, next) => {
    try {
        const { fecha, hora_inicio, hora_fin, lat, lng, radio_km } = req.query;
        
        // Los filtros de tiempo son opcionales para evitar error 400
        const hasTimeFilters = fecha && hora_inicio && hora_fin;

        // Preparar filtro base
        let whereFiltro = {
            esta_aprobado: true // Solo buscar garajes aprobados por un admin
        };

        // Filtrado espacial usando PostGIS si hay coordenadas
        if (lat && lng) {
            const radio = radio_km ? parseFloat(radio_km) * 1000 : 5000; // Por defecto 5km (5000 metros)
            
            // Consultar IDs que están dentro del radio
            const cercanosRaw = await prisma.$queryRaw`
                SELECT id FROM "Garaje"
                WHERE "ubicacion_geo" IS NOT NULL AND ST_DWithin(
                    "ubicacion_geo", 
                    ST_SetSRID(ST_MakePoint(${parseFloat(lng)}, ${parseFloat(lat)}), 4326)::geography, 
                    ${radio}
                )
            `;
            
            const idsCercanos = cercanosRaw.map(g => g.id);
            whereFiltro.id = { in: idsCercanos };
        }

        // Traer todos los garajes que potencialmente sirvan
        const garajes = await prisma.garaje.findMany({
            where: whereFiltro,
            include: {
                horarios_semanales: true,
                fechas_bloqueadas: true,
                reservas: {
                    include: {
                        fechas: true
                    },
                    where: {
                        estado: {
                            notIn: ['CANCELADA', 'REEMBOLSADA']
                        }
                    }
                },
                imagenes: true
            }
        });

        // Aplicamos "La Matemática del Backend" (Filtro) SOLO SI hay parámetros de tiempo
        const garajesDisponibles = hasTimeFilters ? garajes.filter(garaje => {
            const searchDate = new Date(fecha);
            const dayOfWeek = searchDate.getDay(); // 0 (Dom) a 6 (Sab)
            
            const horarioHoy = garaje.horarios_semanales.find(h => h.dia_semana === dayOfWeek);
            if (!horarioHoy || !horarioHoy.abierto) return false;

            if (hora_inicio < horarioHoy.hora_inicio || hora_fin > horarioHoy.hora_fin) {
                return false;
            }

            const estaBloqueada = garaje.fechas_bloqueadas.some(fb =>
                fb.fecha.toISOString().split('T')[0] === fecha
            );
            if (estaBloqueada) return false;

            let reservasSolapadas = 0;
            const timeToMinutes = (timeStr) => {
                const [h, m] = timeStr.split(':').map(Number);
                return (h * 60) + m;
            };

            const searchStartMin = timeToMinutes(hora_inicio);
            const searchEndMin = timeToMinutes(hora_fin);

            garaje.reservas.forEach(reserva => {
                let reservaChoca = false;
                reserva.fechas.forEach(fr => {
                    if (fr.fecha.toISOString().split('T')[0] === fecha) {
                        const resStartMin = timeToMinutes(fr.hora_inicio);
                        const resEndMin = timeToMinutes(fr.hora_fin) + garaje.tiempo_limpieza;

                        if (searchStartMin < resEndMin && searchEndMin > resStartMin) {
                            reservaChoca = true;
                        }
                    }
                });

                if (reservaChoca) {
                    reservasSolapadas++;
                }
            });

            if (reservasSolapadas >= garaje.capacidad_puestos) return false;

            return true;
        }) : garajes;

        // Limpiamos los datos innecesarios de las respuestas antes de mandarlas
        const responseData = garajesDisponibles.map(g => {
            const { reservas, fechas_bloqueadas, horarios_semanales, ...cleanGaraje } = g;
            return cleanGaraje;
        });

        res.json({
            message: 'Búsqueda completada',
            total_encontrados: responseData.length,
            garajes: responseData
        });

    } catch (error) {
        next(error);
    }
}

module.exports = {
    searchGarajes
};
