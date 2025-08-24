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

    return (
        <div className="month-view">
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
    const [currentDate, setCurrentDate] = useState(new Date());
    const [calendarData, setCalendarData] = useState({});
    const [selection, setSelection] = useState([]);
    const [error, setError] = useState(null);
    const scrollRef = useRef(null);

    const dates = [
        new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1),
        currentDate,
        new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1),
    ];

    useEffect(() => {
        const fetchMonthData = async (date) => {
            const monthKey = getMonthKey(date);
            if (calendarData[monthKey]) return; // Don't refetch

            const month = date.getMonth() + 1;
            const year = date.getFullYear();
            const response = await fetch(`/.netlify/functions/api?action=get-calendar&month=${month}&year=${year}`, { credentials: 'include' });
            const data = await response.json();
            
            setCalendarData(prevData => ({ ...prevData, [monthKey]: data }));
        };

        Promise.all(dates.map(fetchMonthData)).catch(err => setError(err.message));
    }, [currentDate]);

    // Snap scrolling and month change logic
    useEffect(() => {
        const scroller = scrollRef.current;
        if (!scroller) return;

        // Start on the middle month
        scroller.scrollTo({ left: scroller.offsetWidth, behavior: 'instant' });

        const handleScroll = () => {
            const scrollLeft = scroller.scrollLeft;
            const childWidth = scroller.offsetWidth;
            if (scrollLeft < childWidth / 2) {
                setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
            } else if (scrollLeft > childWidth * 1.5) {
                setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
            }
        };

        let scrollEndTimer;
        const onScroll = () => {
            clearTimeout(scrollEndTimer);
            scrollEndTimer = setTimeout(handleScroll, 150);
        };

        const handleWheelScroll = (e) => {
            // Prevent the default vertical scroll
            e.preventDefault();
            // Add the vertical scroll amount to the horizontal scroll position
            scroller.scrollLeft += e.deltaY;
        };

        scroller.addEventListener('scroll', onScroll);
        scroller.addEventListener('wheel', handleWheelScroll, { passive: false });

        return () => {
            scroller.removeEventListener('scroll', onScroll);
            scroller.removeEventListener('wheel', handleWheelScroll);
        }
    }, [currentDate]); // Rerun when currentDate changes to reset scroll

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
            // Refresh current month data
            const monthKey = getMonthKey(currentDate);
            const month = currentDate.getMonth() + 1;
            const year = currentDate.getFullYear();
            const newData = await fetch(`/.netlify/functions/api?action=get-calendar&month=${month}&year=${year}`, { credentials: 'include' }).then(res => res.json());
            setCalendarData(prevData => ({ ...prevData, [monthKey]: newData }));
        } catch (err) {
            setError(err.message);
        }
    };

    return (
        <div>
            <div ref={scrollRef} className="calendar-scroll-container">
                {dates.map(date => (
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