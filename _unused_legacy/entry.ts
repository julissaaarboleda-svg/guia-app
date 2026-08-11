import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { jsPDF } from 'npm:jspdf@4.0.0';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { tripId } = await req.json();
    if (!tripId) {
      return Response.json({ error: 'Trip ID required' }, { status: 400 });
    }

    const trips = await base44.entities.Trip.filter({ id: tripId });
    const trip = trips[0];

    if (!trip) {
      return Response.json({ error: 'Trip not found' }, { status: 404 });
    }

    const doc = new jsPDF();
    let y = 20;

    // Title
    doc.setFontSize(24);
    doc.setTextColor(50, 50, 50);
    doc.text(`${trip.flag_emoji || ''} ${trip.title}`, 20, y);
    y += 15;

    // Status
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Status: ${trip.status || 'planning'}`, 20, y);
    y += 10;

    // Dates
    if (trip.start_date) {
      const startDate = new Date(trip.start_date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      doc.text(`Departure: ${startDate}`, 20, y);
      y += 6;
    }
    if (trip.end_date) {
      const endDate = new Date(trip.end_date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      doc.text(`Return: ${endDate}`, 20, y);
      y += 10;
    }

    // Destinations
    if (trip.cities?.length > 0 || trip.country) {
      const destinations = [...(trip.cities || []), trip.country].filter(Boolean).join(', ');
      doc.text(`Destinations: ${destinations}`, 20, y);
      y += 10;
    }

    // Description
    if (trip.description) {
      doc.setFontSize(12);
      doc.setTextColor(50, 50, 50);
      doc.text('About This Trip', 20, y);
      y += 7;
      doc.setFontSize(10);
      doc.setTextColor(80, 80, 80);
      const descLines = doc.splitTextToSize(trip.description, 170);
      descLines.forEach(line => {
        doc.text(line, 20, y);
        y += 5;
      });
      y += 5;
    }

    // Flight Info
    if (trip.flight_info?.outbound || trip.flight_info?.return) {
      doc.setFontSize(12);
      doc.setTextColor(50, 50, 50);
      doc.text('Flight Information', 20, y);
      y += 7;
      doc.setFontSize(10);

      if (trip.flight_info.outbound) {
        doc.setTextColor(100, 100, 100);
        doc.text('Outbound Flight:', 20, y);
        y += 6;
        doc.setTextColor(50, 50, 50);
        if (trip.flight_info.outbound.airline) {
          doc.text(`${trip.flight_info.outbound.airline} ${trip.flight_info.outbound.flight_number || ''}`, 25, y);
          y += 5;
        }
        if (trip.flight_info.outbound.departure_date) {
          doc.text(`${trip.flight_info.outbound.departure_date} ${trip.flight_info.outbound.departure_time || ''}`, 25, y);
          y += 5;
        }
        if (trip.flight_info.outbound.departure_airport) {
          doc.text(`${trip.flight_info.outbound.departure_airport} → ${trip.flight_info.outbound.arrival_airport || ''}`, 25, y);
          y += 5;
        }
        y += 3;
      }

      if (trip.flight_info.return) {
        doc.setTextColor(100, 100, 100);
        doc.text('Return Flight:', 20, y);
        y += 6;
        doc.setTextColor(50, 50, 50);
        if (trip.flight_info.return.airline) {
          doc.text(`${trip.flight_info.return.airline} ${trip.flight_info.return.flight_number || ''}`, 25, y);
          y += 5;
        }
        if (trip.flight_info.return.departure_date) {
          doc.text(`${trip.flight_info.return.departure_date} ${trip.flight_info.return.departure_time || ''}`, 25, y);
          y += 5;
        }
        if (trip.flight_info.return.departure_airport) {
          doc.text(`${trip.flight_info.return.departure_airport} → ${trip.flight_info.return.arrival_airport || ''}`, 25, y);
          y += 5;
        }
        y += 3;
      }
    }

    // Stay Info
    if (trip.stay_info && trip.stay_info.length > 0) {
      doc.setFontSize(12);
      doc.setTextColor(50, 50, 50);
      doc.text('Accommodations', 20, y);
      y += 7;
      doc.setFontSize(10);

      trip.stay_info.forEach((stay, idx) => {
        if (y > 250) {
          doc.addPage();
          y = 20;
        }
        doc.setTextColor(100, 100, 100);
        doc.text(`Stay #${idx + 1}:`, 20, y);
        y += 6;
        doc.setTextColor(50, 50, 50);
        if (stay.property_name) {
          doc.text(stay.property_name, 25, y);
          y += 5;
        }
        if (stay.property_type) {
          doc.text(stay.property_type, 25, y);
          y += 5;
        }
        if (stay.address) {
          doc.text(stay.address, 25, y);
          y += 5;
        }
        if (stay.check_in_date) {
          doc.text(`Check-in: ${stay.check_in_date} ${stay.check_in_time || ''}`, 25, y);
          y += 5;
        }
        if (stay.check_out_date) {
          doc.text(`Check-out: ${stay.check_out_date} ${stay.check_out_time || ''}`, 25, y);
          y += 5;
        }
        if (stay.confirmation_number) {
          doc.text(`Confirmation: ${stay.confirmation_number}`, 25, y);
          y += 5;
        }
        y += 3;
      });
    }

    // Daily Itinerary
    if (trip.itinerary && trip.itinerary.length > 0) {
      if (y > 200) { doc.addPage(); y = 20; }
      doc.setFontSize(14);
      doc.setTextColor(50, 50, 50);
      doc.text('Daily Itinerary', 20, y);
      y += 10;

      trip.itinerary.forEach((day) => {
        if (y > 250) { doc.addPage(); y = 20; }
        doc.setFontSize(11);
        doc.setTextColor(50, 50, 50);
        const dayLabel = `Day ${day.day}${day.date ? ` — ${day.date}` : ''}${day.title ? `: ${day.title}` : ''}`;
        doc.text(dayLabel, 20, y);
        y += 7;

        if (day.description) {
          const plainDesc = day.description.replace(/<[^>]+>/g, '').trim();
          if (plainDesc) {
            doc.setFontSize(9);
            doc.setTextColor(100, 100, 100);
            const descLines = doc.splitTextToSize(plainDesc, 165);
            descLines.forEach(line => {
              if (y > 270) { doc.addPage(); y = 20; }
              doc.text(line, 25, y);
              y += 4;
            });
            y += 2;
          }
        }

        if (day.activities && day.activities.length > 0) {
          day.activities.forEach(act => {
            if (y > 270) { doc.addPage(); y = 20; }
            doc.setFontSize(9);
            doc.setTextColor(80, 80, 80);
            let actLine = '';
            if (act.time) actLine += `${act.time}  `;
            if (act.activity) actLine += act.activity;
            if (act.location) actLine += ` @ ${act.location}`;
            if (actLine.trim()) { doc.text(`• ${actLine.trim()}`, 28, y); y += 5; }
            if (act.notes) {
              doc.setTextColor(120, 120, 120);
              const noteLines = doc.splitTextToSize(act.notes, 155);
              noteLines.forEach(line => {
                if (y > 270) { doc.addPage(); y = 20; }
                doc.text(line, 33, y); y += 4;
              });
            }
          });
        }
        y += 5;
      });
    }

    // Wish List
    if (trip.wish_list?.content) {
      if (y > 200) {
        doc.addPage();
        y = 20;
      }
      doc.setFontSize(12);
      doc.setTextColor(50, 50, 50);
      doc.text('Wish List', 20, y);
      y += 7;
      doc.setFontSize(10);
      doc.setTextColor(80, 80, 80);
      const wishLines = doc.splitTextToSize(trip.wish_list.content, 170);
      wishLines.forEach(line => {
        doc.text(line, 20, y);
        y += 5;
      });
      y += 5;
    }

    // Notes
    if (trip.notes) {
      if (y > 200) {
        doc.addPage();
        y = 20;
      }
      doc.setFontSize(12);
      doc.setTextColor(50, 50, 50);
      doc.text('Notes', 20, y);
      y += 7;
      doc.setFontSize(10);
      doc.setTextColor(80, 80, 80);
      const noteLines = doc.splitTextToSize(trip.notes, 170);
      noteLines.forEach(line => {
        doc.text(line, 20, y);
        y += 5;
      });
    }

    const pdfBytes = doc.output('arraybuffer');

    return new Response(pdfBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${trip.title.replace(/[^a-z0-9]/gi, '_')}_itinerary.pdf"`,
      },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});