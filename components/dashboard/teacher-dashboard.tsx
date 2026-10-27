"use client"

import { MemberDashboard } from "@/components/dashboard/member-dashboard"
import type { Announcement, AttendanceRecord, Booking, Profile, ScheduleSession } from "@/lib/types"

export function TeacherDashboard({
  profile,
  initialMembers,
  initialSchedule,
  initialAnnouncements,
  initialBookings,
  initialAttendanceRecords = [],
}: {
  profile: Profile
  initialMembers: Profile[]
  initialSchedule: ScheduleSession[]
  initialAnnouncements: Announcement[]
  initialBookings: Booking[]
  initialAttendanceRecords?: AttendanceRecord[]
}) {
  return (
    <MemberDashboard
      profile={profile}
      schedule={initialSchedule}
      initialBookings={initialBookings}
      announcements={initialAnnouncements}
      shopItems={[]}
      assessments={[]}
      attendanceRecords={initialAttendanceRecords}
      gearGuides={[]}
      allProfiles={initialMembers}
      leaderBookings={initialBookings}
      supportTickets={[]}
    />
  )
}
