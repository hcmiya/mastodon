import React from 'react';
import ReactDOM from 'react-dom';
import PropTypes from 'prop-types';

class Time extends React.PureComponent {

  static propTypes = {
    timeZone: PropTypes.string,
  };

  constructor() {
    super();
    this.tick = this.tick.bind(this);
    this.d = new Date();
    this.nodes = {};
  }

  componentWillMount() {
    const tz = this.props.timeZone;
    this.tzFmt = {
      year: new Intl.DateTimeFormat('en', { year: 'numeric', timeZone: tz }).format,
      month: new Intl.DateTimeFormat('en', { month: 'numeric', timeZone: tz }).format,
      date: new Intl.DateTimeFormat('en', { day: 'numeric', timeZone: tz }).format,
      hour: new Intl.DateTimeFormat('en', { hour: 'numeric', hour12: false, timeZone: tz }).format,
      minute: new Intl.DateTimeFormat('en', { minute: 'numeric', timeZone: tz }).format,
      second: d => d.getSeconds().toString(),
    };
  }

  componentDidMount() {
    const now = Date.now();
    this.d.getTime(now);
    this.nodes.root = ReactDOM.findDOMNode(this);
    this.nodes.min = this.nodes.root.querySelector('.v6don-estclock-permin');
    this.prevTickMin = Math.floor(now / 60000);
    if (!this.props.timeZone) {
      this.nodes.sec = this.nodes.root.querySelector('.v6don-estclock-sec');
      this.nodes.tick = this.nodes.root.querySelector('.v6don-estclock-tick');
      this.prevTickSec = Math.floor(now / 1000);
      this.prevTickHalfSec = Math.floor(now / 500);
    }
    this.fid = requestAnimationFrame(this.tick);
  }

  componentWillUnmount() {
    cancelAnimationFrame(this.fid);
  }

  ftime(elem) {
    const rtn = this.tzFmt[elem](this.d);
    return rtn.length === 1 ? '0' + rtn : rtn;
  }

  fdate() {
    return (this.props.timeZone ? '' : `${this.ftime('year')}-${this.ftime('month')}-`) + `${this.ftime('date')} ${this.ftime('hour')}:${this.ftime('minute')}`;
  }

  tick() {
    const now = Date.now();
    this.d.setTime(now);
    if (this.nodes.sec) {
      const tickSec = Math.floor(now / 1000);
      const tickHalfSec = Math.floor(now / 500);
      if (tickSec > this.prevTickSec) {
        this.prevTickSec = tickSec;
        this.nodes.root.setAttribute('datetime', this.d.toISOString().replace(/\.\d+/, ''));
        this.nodes.sec.textContent = this.ftime('second');
      }
      if (tickHalfSec > this.prevTickHalfSec) {
        this.prevTickHalfSec = tickHalfSec;
        this.nodes.tick.setAttribute('style', tickHalfSec % 2 ? 'opacity: 0;' : '');
      }
    }
    const tickMin = Math.floor(now / 60000);
    if (tickMin > this.prevTickMin) {
      this.prevTickMin = tickMin;
      this.nodes.min.textContent = this.fdate();
      if (!this.sec) {
        this.nodes.root.setAttribute('datetime', this.d.toISOString().replace(/:\d+\.\d+/, ''));
      }
    }
    this.fid = requestAnimationFrame(this.tick);
  }

  render() {
    const sec = this.props.timeZone ? null :
      (<span>
        <span className='v6don-estclock-tick'>:</span>
        <span className='v6don-estclock-sec'>{this.ftime('second')}</span>
      </span>);
    return (<time dateTime={this.d.toISOString().replace(/\.\d+/, '')}>
      <span className='v6don-estclock-permin'>{this.fdate()}</span>
      {sec}
    </time>);
  }

}

export default () => <p className='v6don-estclock'>Local: <Time />, <abbr title='Eugen Standard Time'>EST</abbr>: <Time timeZone='Europe/Berlin' /></p>;