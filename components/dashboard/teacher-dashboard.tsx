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
  initialShopItems = [],
  initialAssessments = [],
  initialGearGuides = [],
  initialSupportTickets = [],
}: {
  profile: Profile
  initialMembers: Profile[]
  initialSchedule: ScheduleSession[]
  initialAnnouncements: Announcement[]
  initialBookings: Booking[]
  initialAttendanceRecords?: AttendanceRecord[]
  initialShopItems?: any[]
  initialAssessments?: any[]
  initialGearGuides?: any[]
  initialSupportTickets?: any[]
}) {
  return (
    <MemberDashboard
      profile={profile}
      schedule={initialSchedule}
      initialBookings={initialBookings}
      announcements={initialAnnouncements}
      shopItems={initialShopItems}
      assessments={initialAssessments}
      attendanceRecords={initialAttendanceRecords}
      gearGuides={initialGearGuides}
      allProfiles={initialMembers}
      leaderBookings={initialBookings}
      supportTickets={initialSupportTickets}
    />
  )
}
