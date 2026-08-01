export interface Course {
    id: string;
    title: string;
    category: 'GESTION' | 'MARKETING' | 'AGRICULTURE' | 'PLATEFORME' | 'INVESTISSEMENT' | 'HYGIENE';
    targetRole: ('ENTREPRENEUR' | 'INVESTOR' | 'MENTOR' | 'BUILDER' | 'ALL')[];
    duration: string;
    level: 'Débutant' | 'Intermédiaire';
    emoji: string;
    certified: boolean;
    points: number;
    desc: string;
    content: string[];
}
export declare const COURSE_CATALOG: Course[];
export declare function getCoursesForRole(role: string): Course[];
export declare function getCourse(id: string): Course | undefined;
//# sourceMappingURL=academyCourses.d.ts.map