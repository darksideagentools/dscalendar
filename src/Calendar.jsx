import { h } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';

// Helper to get a date string like '2025-08'
const getMonthKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

// Renders a single month grid
function Month({ date, calendarData, selection, onDayClick }) {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days = [];

    for (let i = 0; i < firstDayOfMonth; i++) { days.push(<div class="day empty"></div>); }

    for (let i = 1; i <= daysInMonth; i++) {
        const dayDate = new Date(year, month, i);
        const dateStr = dayDate.toISOString().split('T')[0];
        
        const myDayOff = calendarData.myDaysOff?.find(d => d.date === dateStr);
        const shiftCount = calendarData.shiftDayCounts?.[dateStr] || 0;
        const isSelected = selection.includes(dateStr);

        let dayClass = 'day';
        const isRed = shiftCount >= 2 && !myDayOff;
        const isBooked = !!myDayOff;

        if (isSelected) {
            dayClass += ' requesting';
        } else if (myDayOff) {
            dayClass += myDayOff.status === 'pending' ? ' pending' : ' selected';
        } else if (shiftCount === 1) {
            dayClass += ' yellow';
        } else if (isRed) {
            dayClass += ' red';
        }

        days.push(<div className={dayClass} onClick={() => onDayClick(dateStr, isBooked, isRed)}>{i}</div>);
    }
    while (days.length < 42) { days.push(<div class="day empty"></div>); }

    return (
        <div className="month-view" data-month-key={getMonthKey(date)}>
            <div class="calendar-header">
                <h2>{date.toLocaleString('default', { month: 'long' })} {date.getFullYear()}</h2>
            </div>
            <div class="calendar-grid">
                <div class="day-label">S</div><div class="day-label">M</div><div class="day-label">T</div><div class="day-label">W</div><div class="day-label">T</div><div class="day-label">F</div><div class="day-label">S</div>
                {days}
            </div>
        </div>
    );
}

export function Calendar() {
    const [months, setMonths] = useState(() => {
        const today = new Date();
        return [
            new Date(today.getFullYear(), today.getMonth() - 1, 1),
            today,
            new Date(today.getFullYear(), today.getMonth() + 1, 1),
        ];
    });
    const [calendarData, setCalendarData] = useState({});
    const [selection, setSelection] = useState([]);
    const [error, setError] = useState(null);
    const scrollRef = useRef(null);
    const isInitialLoad = useRef(true);

    const fetchMonthData = async (date) => {
        const monthKey = getMonthKey(date);
        if (calendarData[monthKey]) return;
        try {
            const month = date.getMonth() + 1;
            const year = date.getFullYear();
            const response = await fetch(`/.netlify/functions/api?action=get-calendar&month=${month}&year=${year}`, { credentials: 'include' });
            if (!response.ok) throw new Error('Network response was not ok');
            const data = await response.json();
            setCalendarData(prevData => ({ ...prevData, [monthKey]: data }));
        } catch (err) {
            setError(err.message);
        }
    };

    useEffect(() => {
        months.forEach(fetchMonthData);
    }, [months]);

    useEffect(() => {
        const scroller = scrollRef.current;
        if (!scroller) return;

        if (isInitialLoad.current) {
            scroller.scrollTo({ left: scroller.offsetWidth, behavior: 'instant' });
            isInitialLoad.current = false;
        }

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        if (entry.target.dataset.monthKey === getMonthKey(months[0])) {
                            const firstMonth = months[0];
                            setMonths(prev => [new Date(firstMonth.getFullYear(), firstMonth.getMonth() - 1, 1), ...prev]);
                        } else if (entry.target.dataset.monthKey === getMonthKey(months[months.length - 1])) {
                            const lastMonth = months[months.length - 1];
                            setMonths(prev => [...prev, new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 1)]);
                        }
                    }
                });
            },
            { root: scroller, threshold: 0.6 }
        );

        const handleWheelScroll = (e) => {
            e.preventDefault();
            scroller.scrollBy({ left: e.deltaY, behavior: 'auto' });
        };

        scroller.addEventListener('wheel', handleWheelScroll, { passive: false });
        const firstEl = scroller.firstElementChild;
        const lastEl = scroller.lastElementChild;
        if(firstEl) observer.observe(firstEl);
        if(lastEl) observer.observe(lastEl);

        return () => {
            observer.disconnect();
            scroller.removeEventListener('wheel', handleWheelScroll);
        }
    }, [months]);

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
            const currentMonthKey = getMonthKey(months[1]);
            setCalendarData(prev => ({...prev, [currentMonthKey]: undefined}));
            fetchMonthData(months[1]);
        } catch (err) {
            setError(err.message);
        }
    };

    return (
        <div>
            <div ref={scrollRef} className="calendar-scroll-container">
                {months.map(date => (
                    <Month 
                        key={getMonthKey(date)} 
                        date={date} 
                        calendarData={calendarData[getMonthKey(date)] || {}} 
                        selection={selection} 
                        onDayClick={handleDayClick} 
                    />
                ))}
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