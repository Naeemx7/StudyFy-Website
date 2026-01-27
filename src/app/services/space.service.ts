import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of, delay, tap } from 'rxjs';

/**
 * Interface definition for a Study Space (Subject).
 */
export interface Space {
  id: string;
  title: string;
  description: string;
  progress: number;
  lastAccessed: Date;
}

@Injectable({
  providedIn: 'root'
})
export class SpaceService {
  /**
   * MOCK DATA: Simulating the initial state of the database.
   * In a real app, this would be fetched via HttpClient.
   */
  private initialSpaces: Space[] = [
    {
      id: '1',
      title: 'Operating Systems',
      description: 'CS-301 Final Exam Prep',
      progress: 40,
      lastAccessed: new Date()
    },
    {
      id: '2',
      title: 'Data Structures',
      description: 'Algorithms and complex analysis',
      progress: 100,
      lastAccessed: new Date()
    },
    {
      id: '3',
      title: 'Database Systems',
      description: 'SQL, normalization, transactions',
      progress: 65,
      lastAccessed: new Date()
    }
  ];

  // BehaviorSubject holds the current state of the spaces list
  private spacesSubject = new BehaviorSubject<Space[]>(this.initialSpaces);
  readonly spaces$ = this.spacesSubject.asObservable();

  /**
   * Returns the observable stream of spaces.
   */
  getSpaces() {
    return this.spaces$;
  }

  /**
   * Creates a new space and simulates a backend delay.
   * Updates the local behavior subject optimistically.
   */
  createSpace(title: string, description: string): Observable<Space> {
    const newSpace: Space = {
      id: crypto.randomUUID(),
      title,
      description,
      progress: 0,
      lastAccessed: new Date()
    };
    
    return of(newSpace).pipe(
      delay(500), // Simulate network latency
      tap(space => {
        // Add new space to start of list (LIFO)
        this.spacesSubject.next([space, ...this.spacesSubject.value]);
      })
    );
  }
}
