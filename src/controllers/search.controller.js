const prisma = require('../db/prisma');

/**
 * 1. Motor de Búsqueda de Garajes
 * El vendedor busca un garaje pasándole Fecha, Hora Inicio y Hora Fin.
 */
const searchGarajes = async (req, res, next) => {
    try {
        const { fecha, hora_inicio, hora_fin } = req.query;

        if (!fecha || !hora_inicio || !hora_fin) {
            return res.status(400).json({ error: 'Faltan parámetros: fecha, hora_inicio, hora_fin' });
        }

        // Convertir strings a objetos manipulables
        const searchDate = new Date(fecha);
        const dayOfWeek = searchDate.getDay(); // 0 (Dom) a 6 (Sab)

        // Traer todos los garajes que potencialmente sirvan (luego filtramos)
        // Optimizamos trayendo sus horarios para filtrar día de la semana
        const garajes = await prisma.garaje.findMany({
            include: {
                horarios_semanales: true,
                fechas_bloqueadas: true,
                reservas: {
                    include: {
                        fechas: true
                    },
                    where: {
                        // Ignoramos las CANCELADAS y REEMBOLSADAS, las demás (ACEPTADA, PAGADA, etc) bloquean
                        estado: {
                            notIn: ['CANCELADA', 'REEMBOLSADA']
                        }
                    }
                },
                imagenes: true
            }
        });

        // Aplicamos "La Matemática del Backend" (Filtro)
        const garajesDisponibles = garajes.filter(garaje => {
            // 1. ¿El garaje abre ese día de la semana?
            const horarioHoy = garaje.horarios_semanales.find(h => h.dia_semana === dayOfWeek);
            if (!horarioHoy || !horarioHoy.abierto) return false;

            // Revisar si está dentro de su rango de hora de apertura
            if (hora_inicio < horarioHoy.hora_inicio || hora_fin > horarioHoy.hora_fin) {
                return false;
            }

            // 2. ¿La fecha buscada está en la tabla de FechaBloqueada?
            const estaBloqueada = garaje.fechas_bloqueadas.some(fb =>
                fb.fecha.toISOString().split('T')[0] === fecha
            );
            if (estaBloqueada) return false;

            // 3. ¿El rango choca con los bloques de FechaReserva sumando tiempo de limpieza?
            let hayChoque = false;

            // Función auxiliar para convertir "HH:mm" a minutos para facilitar matemáticas
            const timeToMinutes = (timeStr) => {
                const [h, m] = timeStr.split(':').map(Number);
                return (h * 60) + m;
            };

            const searchStartMin = timeToMinutes(hora_inicio);
            const searchEndMin = timeToMinutes(hora_fin);

            garaje.reservas.forEach(reserva => {
                reserva.fechas.forEach(fr => {
                    if (fr.fecha.toISOString().split('T')[0] === fecha) {
                        // Convertir hora reserva existente a minutos
                        const resStartMin = timeToMinutes(fr.hora_inicio);
                        // El fin de la reserva existente se expande por el tiempo de limpieza necesario
                        const resEndMin = timeToMinutes(fr.hora_fin) + garaje.tiempo_limpieza;

                        // Verificar Solapamiento:
                        // Si mi búsqueda empieza antes de que el otro salga (con limpieza) 
                        // Y mi búsqueda termina después de que el otro entró
                        if (searchStartMin < resEndMin && searchEndMin > resStartMin) {
                            hayChoque = true;
                        }
                    }
                });
            });

            if (hayChoque) return false;

            return true;
        });

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
