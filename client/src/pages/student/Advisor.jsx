import Icon from '../../components/Icon';
import Booking, { HoursChips } from '../../components/Booking';
import { Async, Empty } from '../../components/ui';
import { useApi } from '../../lib/useApi';
import { useApp } from '../../context/AppContext';
import { fmtDate, fmtTime, initials, isUpcoming } from '../../lib/format';

export default function Advisor() {
  const { user, terms: t } = useApp();
  const state = useApi({ adv: `/faculty/${user.advisorId}`, appts: '/appointments' });
  if (!user.advisorId) return <Empty text={`You don't have a ${t.advisorLong.toLowerCase()} assigned yet. Ask your ${t.inst}'s admin.`} />;

  return (
    <Async state={state}>
      {(d) => {
        const f = d.adv.faculty;
        const mine = d.appts.appointments.filter((a) => a.facultyId === f.id && isUpcoming(a));
        return (
          <>
            <div className="card card-pad">
              <div className="profile">
                <span className="avatar xl">{initials(f.name)}</span>
                <div className="pi">
                  <span className="pill confirmed">Your {t.advisorLong.toLowerCase()}</span>
                  <h2 className="mt-s">{f.name}</h2>
                  <p className="muted">{[f.title, f.room, f.email].filter(Boolean).join(', ')}</p>
                  <HoursChips hours={f.hours} />
                </div>
              </div>
              {mine.length > 0 && (
                <p className="already"><Icon name="info" size={18} />
                  <span>You already have {mine.length === 1 ? 'a booking' : 'bookings'} with your {t.advisor.toLowerCase()}: {mine.map((a) => `${fmtDate(a.date)} at ${fmtTime(a.time)} (${a.status.toLowerCase()})`).join('; ')}.</span></p>
              )}
            </div>
            <div className="sec"><Booking f={f} type="Advising" course={null} onRefresh={state.reload} /></div>
          </>
        );
      }}
    </Async>
  );
}
