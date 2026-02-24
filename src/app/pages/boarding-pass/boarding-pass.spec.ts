import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BoardingPass } from './boarding-pass';

describe('BoardingPass', () => {
  let component: BoardingPass;
  let fixture: ComponentFixture<BoardingPass>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BoardingPass]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BoardingPass);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
