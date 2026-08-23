import { format, parseISO } from "date-fns";

function dateRangeLabel(trip) {
  if (!trip.start_date) return "";
  const start = format(parseISO(trip.start_date), "MMM d");
  const end = trip.end_date ? format(parseISO(trip.end_date), "d") : null;
  return end ? `${start} – ${end}` : start;
}

export default function MemoriesCover({ trip, cover, days, placesCount, photosCount }) {
  const cities = trip.cities || [];

  return (
    <div className="relative w-full h-[210px] rounded-2xl overflow-hidden">
      {cover ? (
        <img src={cover} alt="" className="absolute inset-0 w-full h-full object-cover" />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-charcoal via-olive/40 to-forest/60" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-black/5" />

      <div className="absolute left-4 right-4 bottom-4">
        {dateRangeLabel(trip) && (
          <span className="inline-block font-body text-[9px] px-2.5 py-1 rounded-full mb-2" style={{ background: "#A7773F", color: "#F7F3EC" }}>
            {dateRangeLabel(trip)}
          </span>
        )}
        <p className="font-heading text-xl text-white font-semibold leading-tight mb-1.5">{trip.title}</p>

        {cities.length > 0 && (
          <div className="flex items-center flex-wrap gap-1 mb-3">
            {cities.map((c, i) => (
              <span key={c} className="inline-flex items-center gap-1">
                {i > 0 && <span className="w-3.5 h-px bg-white/40" />}
                <span className="w-1.5 h-1.5 rounded-full bg-white" />
              </span>
            ))}
            <span className="font-body text-[10px] text-white/75 ml-1">{cities.length} cit{cities.length !== 1 ? "ies" : "y"}</span>
          </div>
        )}

        <div className="flex gap-4">
          {days != null && (
            <div>
              <p className="font-heading text-base text-white leading-none">{days}</p>
              <p className="font-body text-[9.5px] text-white/70 mt-1">days</p>
            </div>
          )}
          {placesCount > 0 && (
            <div>
              <p className="font-heading text-base text-white leading-none">{placesCount}</p>
              <p className="font-body text-[9.5px] text-white/70 mt-1">place{placesCount !== 1 ? "s" : ""} saved</p>
            </div>
          )}
          {photosCount > 0 && (
            <div>
              <p className="font-heading text-base text-white leading-none">{photosCount}</p>
              <p className="font-body text-[9.5px] text-white/70 mt-1">photo{photosCount !== 1 ? "s" : ""}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
