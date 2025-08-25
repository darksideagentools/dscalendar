import { h } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';

export function Calendar() {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [calendarData, setCalendarData] = useState({ shiftDayCounts: {}, myDaysOff: [] });
    const [selection, setSelection] = useState([]);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(true);
    const calendarRef = useRef(null);
    const isScrolling = useRef(false);

    useEffect(() => {
        const fetchCalendarData = async () => {
            setLoading(true);
            try {
                const month = currentDate.getMonth() + 1;
                const year = currentDate.getFullYear();
                const response = await fetch(`/.netlify/functions/api?action=get-calendar&month=${month}&year=${year}`, { credentials: 'include' });
                if (!response.ok) {
                    const errData = await response.json();
                    throw new Error(errData.message || 'Failed to fetch calendar data');
                }
                const data = await response.json();
                setCalendarData(data);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };
        fetchCalendarData();
    }, [currentDate]);

    const changeMonth = (offset) => {
        setSelection([]);
        setCurrentDate(prevDate => new Date(prevDate.getFullYear(), prevDate.getMonth() + offset, 1));
    };

    useEffect(() => {
        const calendarEl = calendarRef.current;
        if (!calendarEl) return;

        const handleWheel = (e) => {
            e.preventDefault();
            if (isScrolling.current) return;
            isScrolling.current = true;

            if (e.deltaY < 0) {
                changeMonth(-1);
            } else {
                changeMonth(1);
            }
            // Debounce to prevent rapid month changes
            setTimeout(() => { isScrolling.current = false; }, 500);
        };

        calendarEl.addEventListener('wheel', handleWheel, { passive: false });
        return () => calendarEl.removeEventListener('wheel', handleWheel);
    }, []);

    const handleDayClick = (dateStr, isBooked, isRed) => {
        if (isBooked || isRed) return;
        if (selection.includes(dateStr)) {
            setSelection(selection.filter(d => d !== dateStr));
        } else {
            setSelection([...selection, dateStr]);
        }
    };

    const handleRequestDaysOff = async () => {
        setError(null);
        try {
            const response = await fetch('/.netlify/functions/api?action=request-days-off', {
                method: 'POST', credentials: 'include', body: JSON.stringify({ dates: selection })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Failed to submit request');
            setSelection([]);
            // Manually trigger a refresh
            setCurrentDate(new Date(currentDate.getTime()));
        } catch (err) {
            setError(err.message);
        }
    };

    const renderCalendarGrid = () => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const firstDayOfMonth = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const days = [];

        for (let i = 0; i < firstDayOfMonth; i++) { days.push(<div class="day empty"></div>); }

        for (let i = 1; i <= daysInMonth; i++) {
            const dateStr = new Date(year, month, i).toISOString().split('T')[0];
            const myDayOff = calendarData.myDaysOff.find(d => d.date === dateStr);
            const shiftCount = calendarData.shiftDayCounts[dateStr] || 0;
            const isSelected = selection.includes(dateStr);
            let dayClass = 'day';
            const isRed = shiftCount >= 2 && !myDayOff;
            const isBooked = !!myDayOff;

            if (isSelected) dayClass += ' requesting';
            else if (myDayOff) dayClass += myDayOff.status === 'pending' ? ' pending' : ' selected';
            else if (shiftCount === 1) dayClass += ' yellow';
            else if (isRed) dayClass += ' red';

            days.push(<div className={dayClass} onClick={() => handleDayClick(dateStr, isBooked, isRed)}>{i}</div>);
        }
        while (days.length < 42) { days.push(<div class="day empty"></div>); }
        return days;
    };

    return (
        <div ref={calendarRef}>
            <div class="calendar-header">
                <button onClick={() => changeMonth(-1)}>&#9664;</button>
                <h2>{currentDate.toLocaleString('default', { month: 'long' })} {currentDate.getFullYear()}</h2>
                <button onClick={() => changeMonth(1)}>&#9654;</button>
            </div>
            <div className="calendar-grid">
                <div class="day-label">S</div><div class="day-label">M</div><div class="day-label">T</div><div class="day-label">W</div><div class="day-label">T</div><div class="day-label">F</div><div class="day-label">S</div>
                {loading ? <div></div> : renderCalendarGrid()}
            </div>
            {error && <div class="error-message">{error}</div>}
            <div class="calendar-actions">
                <button onClick={handleRequestDaysOff} disabled={selection.length === 0}>
                    Request {selection.length} Day(s) Off
                </button>
            </div>
        </div>
    );
}
