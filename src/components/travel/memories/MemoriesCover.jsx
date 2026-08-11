// Props confirmed from MemoriesTab.jsx: <MemoriesCover cover={cover} reflection={reflection} tripName={trip.title} />
export default function MemoriesCover({ cover, reflection, tripName }) {
  return (
    <div className="relative w-full h-[200px] rounded-2xl overflow-hidden">
      {cover ? (
        <img src={cover} alt="" className="absolute inset-0 w-full h-full object-cover" />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-charcoal via-olive/40 to-forest/60" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 p-4">
        <p className="font-heading text-xl text-white font-semibold leading-tight">{reflection}</p>
        <p className="font-body text-[11px] text-white/70 mt-1 flex items-center gap-1">♡ MEMORIES · {tripName}</p>
      </div>
    </div>
  );
}
