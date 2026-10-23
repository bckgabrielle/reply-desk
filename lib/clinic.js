"use strict";
module.exports = {
  clinic: "Lakeside Endocrine Clinic (synthetic data)",
  doctors: [{ id: "achieng", name: "Dr Achieng", specialty: "Endocrinology" }],
  slots: [
    { id: "s1", label: "Wed 4 Nov 09:00", day: "wed" },
    { id: "s2", label: "Thu 5 Nov 14:00", day: "thu" },
    { id: "s3", label: "Fri 6 Nov 11:00", day: "fri" },
    { id: "s4", label: "Mon 9 Nov 10:00", day: "mon" }
  ],
  appointments: [
    { id: "a1", patient: "Amina W.", doctor: "achieng", when: "Tue 3 Nov, 08:00" },
    { id: "a2", patient: "Brian O.", doctor: "achieng", when: "Tue 3 Nov, 08:30" },
    { id: "a3", patient: "Carol M.", doctor: "achieng", when: "Tue 3 Nov, 09:00" },
    { id: "a4", patient: "David K.", doctor: "achieng", when: "Tue 3 Nov, 09:30" },
    { id: "a5", patient: "Esther N.", doctor: "achieng", when: "Tue 3 Nov, 10:00" },
    { id: "a6", patient: "Felix R.", doctor: "achieng", when: "Tue 3 Nov, 10:30" },
    { id: "a7", patient: "Grace T.", doctor: "achieng", when: "Tue 3 Nov, 11:00" },
    { id: "a8", patient: "Hassan J.", doctor: "achieng", when: "Tue 3 Nov, 11:30" },
    { id: "a9", patient: "Irene L.", doctor: "achieng", when: "Tue 3 Nov, 12:00" },
    { id: "a10", patient: "James P.", doctor: "achieng", when: "Tue 3 Nov, 12:30" },
    { id: "a11", patient: "Kamau S.", doctor: "achieng", when: "Tue 3 Nov, 13:00" },
    { id: "a12", patient: "Lucy A.", doctor: "achieng", when: "Tue 3 Nov, 13:30" }
  ]
};