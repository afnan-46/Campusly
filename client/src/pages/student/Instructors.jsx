import { useSearchParams } from 'react-router-dom';
import Booking from '../../components/Booking';
import { Async, Empty } from '../../components/ui';
import { useApi } from '../../lib/useApi';
import { fmtDate, fmtTime } from '../../lib/format';
import { useApp } from '../../context/AppContext';

export default function Instructors() {
  const [params, setParams] = useSearchParams();
  const sel = params.get('course');
  const state = useApi('/faculty/courses');
  const { terms: t } = useApp();
  const c1 = t.course.toLowerCase();

  return (
    <Async state={state}>
      {(d) => {
        const list = d.courses;
        const c = list.find((x) => x.code === sel);
        if (!list.length) return <Empty text={`You are not enrolled in any ${c1}s yet.`} />;
        return (
          <>
            <p className="lead">Pick one of your {c1}s to see when its teacher is free to meet.</p>
            <div className="courses sec">
              {list.map((x) => (
                <button key={x.code} className="course" aria-pressed={sel === x.code} onClick={() => setParams({ course: x.code }, { replace: true, state: window.history.state?.usr })}>
                  <span className="code">{x.code}</span>
                  <span className="ci"><b>{x.title}</b><small>{x.section ? `${/^\d+$/.test(x.section) ? 'Section ' : ''}${x.section}, ` : ''}{x.faculty?.name || 'No teacher assigned yet'}</small>
                    <em>{!x.faculty ? 'Ask the admin to assign a teacher' : x.faculty.nextFree ? `Next free ${fmtDate(x.faculty.nextFree.date)}, ${fmtTime(x.faculty.nextFree.time)}` : 'No free slots this week'}</em></span>
                </button>
              ))}
            </div>
            {c && c.faculty && <div className="sec"><Booking key={c.code} f={c.faculty} type="Course" course={c.code} onRefresh={state.reload} /></div>}
          </>
        );
      }}
    </Async>
  );
}
