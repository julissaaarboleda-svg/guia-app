import { Plane, Clock } from "lucide-react";

function formatTime(time) {
  if (!time) return null;
  const [h, m] = time.split(":");
  if (!h || !m) return time;
  const hour = parseInt(h);
  const ampm = hour >= 12 ? "p.m." : "a.m.";
  const h12 = hour % 12 || 12;
  return `${h12}:${m} ${ampm}`;
}

function formatDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function FlightLeg({ flight }) {
  if (!flight || (!flight.airline && !flight.departure_airport)) return null;

  return (
    <div className="mb-2 font-body">
      {(flight.airline || flight.flight_number) && (
        <div className="flex items-center gap-2 mb-3">
          <Plane className="w-3.5 h-3.5 text-muted-foreground rotate-45" />
          <span className="text-sm font-medium text-foreground">
            {[flight.airline, flight.flight_number].filter(Boolean).join(" | ")}
          </span>
        </div>
      )}

      <div className="relative pl-6">
        <div className="absolute left-[7px] top-2 bottom-2 border-l-2 border-dashed border-border" />

        <div className="relative mb-5">
          <div className="absolute -left-6 top-0.5 w-3.5 h-3.5 rounded-full bg-accent flex items-center justify-center">
            <div className="w-1.5 h-1.5 rounded-full bg-card" />
          </div>
          <div>
            <p className="text-sm font-bold text-foreground">{formatTime(flight.departure_time)}</p>
            {flight.departure_airport && (
              <p className="text-xs text-muted-foreground mt-0.5">{flight.departure_airport}</p>
            )}
            {flight.departure_date && (
              <p className="text-xs text-muted-foreground">{formatDate(flight.departure_date)}</p>
            )}
          </div>
        </div>

        {(flight.seat || flight.terminal_gate) && (
          <div className="relative mb-5">
            <div className="absolute -left-[23px] top-0.5">
              <Clock className="w-3 h-3 text-muted-foreground/40" />
            </div>
            <div className="flex gap-3">
              {flight.seat && (
                <span className="text-xs text-muted-foreground">Seat: <span className="text-foreground font-medium">{flight.seat}</span></span>
              )}
              {flight.terminal_gate && (
                <span className="text-xs text-muted-foreground">Gate: <span className="text-foreground font-medium">{flight.terminal_gate}</span></span>
              )}
            </div>
          </div>
        )}

        <div className="relative">
          <div className="absolute -left-6 top-0.5 w-3.5 h-3.5 rounded-full border-2 border-accent bg-card flex items-center justify-center">
            <div className="w-1.5 h-1.5 rounded-full bg-accent" />
          </div>
          <div>
            <p className="text-sm font-bold text-foreground">{formatTime(flight.arrival_time)}</p>
            {flight.arrival_airport && (
              <p className="text-xs text-muted-foreground mt-0.5">{flight.arrival_airport}</p>
            )}
            {flight.arrival_date && (
              <p className="text-xs text-muted-foreground">{formatDate(flight.arrival_date)}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function FlightCard({ flight, label }) {
  return (
    <div>
      {(flight.departure_airport || flight.arrival_airport) && (
        <div className="mb-4">
          <div className="flex items-center gap-1 text-muted-foreground text-[10px] uppercase tracking-wider font-semibold mb-1">{label}</div>
          {(flight.departure_airport && flight.arrival_airport) && (
            <p className="text-base font-bold text-foreground">
              {flight.departure_airport} → {flight.arrival_airport}
            </p>
          )}
          {flight.departure_date && (
            <p className="text-xs text-muted-foreground">{formatDate(flight.departure_date)}</p>
          )}
        </div>
      )}
      <FlightLeg flight={flight} />
    </div>
  );
}

export default function FlightTimeline({ flights, flightInfo }) {
  // Prefer new `flights` array; fall back to legacy `flight_info`
  if (flights?.length > 0) {
    return (
      <div className="space-y-5 font-body">
        {flights.map((flight, i) => (
          <div key={i}>
            {i > 0 && <div className="border-t border-border mb-5" />}
            <FlightCard flight={flight} label={flight.label || `Flight ${i + 1}`} />
          </div>
        ))}
      </div>
    );
  }

  const outbound = flightInfo?.outbound;
  const returnFlight = flightInfo?.return;

  if (!outbound && !returnFlight) {
    return <p className="text-muted-foreground text-sm text-center py-4 font-body">No flight info yet</p>;
  }

  return (
    <div className="space-y-5 font-body">
      {outbound && (outbound.airline || outbound.departure_airport) && (
        <FlightCard flight={outbound} label="Outbound" />
      )}
      {outbound && returnFlight && (outbound.airline || outbound.departure_airport) && (returnFlight.airline || returnFlight.departure_airport) && (
        <div className="border-t border-border" />
      )}
      {returnFlight && (returnFlight.airline || returnFlight.departure_airport) && (
        <FlightCard flight={returnFlight} label="Return" />
      )}
    </div>
  );
}