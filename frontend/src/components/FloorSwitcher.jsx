export default function FloorSwitcher({ floors, activeFloor, onChange, floorsOnRoute }) {
  return (
    <div className="floor-switcher">
      {floors.map((floor) => {
        const onRoute = floorsOnRoute && floorsOnRoute.includes(floor);
        return (
          <button
            key={floor}
            className={`floor-btn ${floor === activeFloor ? 'active' : ''} ${onRoute ? 'on-route' : ''}`}
            onClick={() => onChange(floor)}
          >
            Kat {floor}
          </button>
        );
      })}
    </div>
  );
}
