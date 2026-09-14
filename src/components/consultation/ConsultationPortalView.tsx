import React, { useState, useEffect } from 'react';
import { 
  Stethoscope, 
  Calendar, 
  Download, 
  FileText, 
  Clock, 
  MapPin, 
  Star, 
  CheckCircle2, 
  User, 
  Building2, 
  Phone, 
  Video, 
  Sparkles,
  Printer
} from 'lucide-react';
import { ConsultationDoctor, ConsultationAppointment, User as PatientUser, RegionalLanguage } from '../../types';
import { soundEffects } from '../../utils/soundEffects';
import { saveAppointmentToFirebase, saveReminderToFirebase } from '../../lib/firebase';

interface ConsultationPortalViewProps {
  user: PatientUser;
  language?: RegionalLanguage;
  onAppointmentBooked?: (appointment: ConsultationAppointment, reminder?: any) => void;
}

export const ConsultationPortalView: React.FC<ConsultationPortalViewProps> = ({ user, language = 'en', onAppointmentBooked }) => {
  const [doctors, setDoctors] = useState<ConsultationDoctor[]>([]);
  const [appointments, setAppointments] = useState<ConsultationAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDoctor, setSelectedDoctor] = useState<ConsultationDoctor | null>(null);
  const [appointmentDate, setAppointmentDate] = useState('2026-09-22');
  const [appointmentTime, setAppointmentTime] = useState('02:30 PM');
  const [consultNotes, setConsultNotes] = useState('Review of recent sequence recall performance and sleep patterns.');
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [clinicalSummary, setClinicalSummary] = useState<any | null>(null);
  const [isViewingReport, setIsViewingReport] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [docRes, aptRes] = await Promise.all([
        fetch('/api/consultations/doctors'),
        fetch(`/api/consultations/appointments/${user.id}`)
      ]);
      if (docRes.ok) {
        const data = await docRes.json();
        setDoctors(data.doctors || []);
        if (data.doctors && data.doctors.length > 0) {
          setSelectedDoctor(data.doctors[0]);
        }
      }
      if (aptRes.ok) {
        const data = await aptRes.json();
        setAppointments(data.appointments || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user.id]);

  const handleBookAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDoctor) return;

    soundEffects.playSuccessChime();

    try {
      const res = await fetch('/api/consultations/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          doctor_id: selectedDoctor.id,
          date: appointmentDate,
          time: appointmentTime,
          notes: consultNotes
        })
      });
      if (res.ok) {
        const data = await res.json();
        setAppointments((prev) => [data.appointment, ...prev]);
        setBookingSuccess(true);
        if (data.appointment) {
          saveAppointmentToFirebase(data.appointment).catch(() => {});
        }
        if (data.reminder) {
          saveReminderToFirebase(data.reminder).catch(() => {});
        }
        if (onAppointmentBooked) {
          onAppointmentBooked(data.appointment, data.reminder);
        }
        setTimeout(() => setBookingSuccess(false), 4000);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleFetchClinicalSummary = async () => {
    soundEffects.playGentleTap(520);
    try {
      const res = await fetch(`/api/consultations/clinical-summary/${user.id}`);
      if (res.ok) {
        const data = await res.json();
        setClinicalSummary(data);
        setIsViewingReport(true);
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Clinical Header */}
      <div className="bg-gradient-to-r from-cyan-900 via-blue-900 to-indigo-950 text-white rounded-3xl p-6 sm:p-7 shadow-xl border border-cyan-800 relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="bg-cyan-500/20 text-cyan-200 text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider border border-cyan-400/30 flex items-center gap-1.5 w-fit">
              <Stethoscope className="w-3.5 h-3.5 text-cyan-300" />
              Clinical Portal • Medical Collaboration
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-white">
              Professional Consultation Portal
            </h2>
            <p className="text-sm text-cyan-100 max-w-xl">
              Connect directly with verified North East India neurologists, book clinical tele-consultations, and export standardized cognitive summaries.
            </p>
          </div>

          <button
            onClick={handleFetchClinicalSummary}
            className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white px-5 py-3 rounded-2xl font-black text-xs sm:text-sm shadow-md transition-all cursor-pointer whitespace-nowrap"
          >
            <Download className="w-4 h-4" />
            <span>Generate Clinical Summary</span>
          </button>
        </div>
      </div>

      {/* Clinical Summary Modal / Viewer */}
      {isViewingReport && clinicalSummary && (
        <div className="bg-white border-2 border-amber-400 rounded-3xl p-6 shadow-xl space-y-4 animate-in fade-in">
          <div className="flex items-center justify-between border-b border-amber-200 pb-3 flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-900 flex items-center justify-center">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-black uppercase tracking-wider text-amber-800">
                  Doctor Ready Cognitive Export
                </span>
                <h3 className="text-lg font-black text-gray-900">
                  Clinical Summary for {clinicalSummary.patient.name}
                </h3>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => window.print()}
                className="px-3.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl text-xs font-black flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print / Save PDF</span>
              </button>
              <button
                onClick={() => setIsViewingReport(false)}
                className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-black cursor-pointer"
              >
                Close Report
              </button>
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-3">
            <div className="bg-amber-50/60 p-3.5 rounded-2xl border border-amber-100">
              <span className="text-[11px] font-bold text-gray-500 uppercase block">Cognitive Accuracy</span>
              <span className="text-xl font-black text-amber-950">
                {clinicalSummary.metrics.average_cognitive_accuracy_pct}%
              </span>
              <span className="text-[11px] text-emerald-700 font-bold block mt-0.5">
                {clinicalSummary.metrics.recent_trend} trajectory
              </span>
            </div>

            <div className="bg-amber-50/60 p-3.5 rounded-2xl border border-amber-100">
              <span className="text-[11px] font-bold text-gray-500 uppercase block">Medication Adherence</span>
              <span className="text-xl font-black text-emerald-700">
                {clinicalSummary.metrics.medication_adherence_today_pct}%
              </span>
              <span className="text-[11px] text-gray-600 font-medium block mt-0.5">Active daily compliance</span>
            </div>

            <div className="bg-amber-50/60 p-3.5 rounded-2xl border border-amber-100">
              <span className="text-[11px] font-bold text-gray-500 uppercase block">Clinical Engagement</span>
              <span className="text-xl font-black text-blue-900">
                {clinicalSummary.clinical_proxy_score}
              </span>
              <span className="text-[11px] text-gray-600 font-medium block mt-0.5">MMSE Proxy Indicator</span>
            </div>
          </div>

          <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200 text-xs space-y-1.5">
            <strong className="text-gray-900 block uppercase font-black text-[11px]">
              AI Care Observation & Pacing Rationale:
            </strong>
            <p className="text-gray-700 leading-relaxed">
              {clinicalSummary.observations}
            </p>
            <p className="text-[10px] text-gray-500 pt-1 italic">
              {clinicalSummary.disclaimer}
            </p>
          </div>
        </div>
      )}

      {/* Specialist Doctors Grid & Booking */}
      <div className="grid lg:grid-cols-12 gap-6">
        {/* Verified Specialists Directory (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between border-b border-gray-200 pb-2">
            <h3 className="text-lg font-black text-gray-900 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-blue-600" />
              North East India Specialist Doctors
            </h3>
            <span className="text-xs text-gray-500 font-bold">Assam • Meghalaya • Manipur</span>
          </div>

          {doctors.map((doc) => {
            const isSelected = selectedDoctor?.id === doc.id;
            return (
              <div
                key={doc.id}
                onClick={() => {
                  soundEffects.playGentleTap(450);
                  setSelectedDoctor(doc);
                }}
                className={`p-4 sm:p-5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between ${
                  isSelected
                    ? 'bg-blue-50/60 border-blue-500 shadow-sm'
                    : 'bg-white border-gray-200 hover:border-blue-300'
                }`}
              >
                <div className="flex items-center gap-3.5">
                  <img
                    src={doc.avatar}
                    alt={doc.name}
                    className="w-14 h-14 rounded-2xl object-cover border-2 border-blue-200 shrink-0"
                  />
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-base font-black text-gray-900">{doc.name}</span>
                      <span className="flex items-center gap-1 text-xs font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                        <Star className="w-3 h-3 fill-amber-500" />
                        {doc.rating}
                      </span>
                    </div>
                    <p className="text-xs font-bold text-blue-800">{doc.specialty}</p>
                    <div className="flex items-center gap-2 text-xs text-gray-600">
                      <MapPin className="w-3.5 h-3.5 text-red-500" />
                      <span>{doc.hospital} ({doc.location})</span>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-gray-500 font-medium">
                      <span>Schedule: {doc.available_days}</span>
                      <span className="text-emerald-700 font-bold">Fee: {doc.consult_fee}</span>
                    </div>
                  </div>
                </div>

                <div className="shrink-0">
                  <span className={`px-3 py-1.5 rounded-xl text-xs font-black block text-center ${
                    isSelected ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'
                  }`}>
                    {isSelected ? 'Selected' : 'Select Doctor'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Appointment Scheduler & History (5 cols) */}
        <div className="lg:col-span-5 space-y-5">
          {/* Booking Form */}
          <form onSubmit={handleBookAppointment} className="bg-white rounded-3xl border-2 border-blue-200 p-5 sm:p-6 shadow-sm space-y-4">
            <div className="border-b border-blue-100 pb-2">
              <span className="text-xs font-black uppercase tracking-wide text-blue-700">Schedule Consultation</span>
              <h4 className="text-base font-black text-gray-900">
                Book with {selectedDoctor ? selectedDoctor.name.split(',')[0] : 'Specialist'}
              </h4>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-black text-gray-700 uppercase mb-1">Date</label>
                <input
                  type="date"
                  required
                  value={appointmentDate}
                  onChange={(e) => setAppointmentDate(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-gray-50 border border-gray-300 rounded-xl font-bold"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black text-gray-700 uppercase mb-1">Time Slot</label>
                <select
                  value={appointmentTime}
                  onChange={(e) => setAppointmentTime(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-gray-50 border border-gray-300 rounded-xl font-bold"
                >
                  <option value="10:30 AM">10:30 AM (Morning)</option>
                  <option value="02:30 PM">02:30 PM (Afternoon)</option>
                  <option value="04:00 PM">04:00 PM (Evening)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-black text-gray-700 uppercase mb-1">
                Clinical Focus / Symptoms to Discuss
              </label>
              <textarea
                rows={2}
                value={consultNotes}
                onChange={(e) => setConsultNotes(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-gray-50 border border-gray-300 rounded-xl font-medium"
              />
            </div>

            {bookingSuccess && (
              <div className="p-2.5 bg-emerald-100 border border-emerald-300 rounded-xl text-emerald-900 text-xs font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                <span>Appointment confirmed and synchronized with regional hospital queue.</span>
              </div>
            )}

            <button
              type="submit"
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs sm:text-sm font-black shadow transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <Video className="w-4 h-4" />
              <span>Confirm Tele / In-Person Appointment</span>
            </button>
          </form>

          {/* Scheduled Appointments History */}
          <div className="bg-white rounded-3xl border-2 border-gray-200 p-5 shadow-sm space-y-3">
            <h4 className="text-xs font-black uppercase tracking-wide text-gray-700 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-blue-600" />
              Upcoming Scheduled Visits
            </h4>

            {appointments.length === 0 ? (
              <p className="text-xs text-gray-500 italic py-2">No upcoming consultation visits recorded.</p>
            ) : (
              <div className="space-y-2">
                {appointments.map((apt) => (
                  <div key={apt.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
                    <div className="flex items-center justify-between font-bold">
                      <span className="text-gray-900">{apt.doctor_name}</span>
                      <span className="text-emerald-700 font-black uppercase text-[10px] bg-emerald-100 px-2 py-0.5 rounded-full">
                        {apt.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-500 font-medium">
                      <Clock className="w-3.5 h-3.5 text-blue-600" />
                      <span>{apt.date} at {apt.time}</span>
                    </div>
                    <p className="text-[11px] text-gray-600 italic mt-0.5">&ldquo;{apt.notes}&rdquo;</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
