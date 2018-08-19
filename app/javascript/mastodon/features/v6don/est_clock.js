import React from 'react';
import ReactDOM from 'react-dom';
import PropTypes from 'prop-types';

class Time extends React.PureComponent {

  static propTypes = {
    timeZone: PropTypes.string,
    full: PropTypes.bool,
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
    if (this.props.full) {
      this.nodes.sec = this.nodes.root.querySelector('.v6don-estclock-sec');
      this.nodes.tick = this.nodes.root.querySelector('.v6don-estclock-tick');
    }
    this.tickInterval = this.props.full ? 500 : 60000;
    this.nextEpoch = now - this.tickInterval - 1;
    this.fid = requestAnimationFrame(this.tick);
  }

  componentWillUnmount() {
    cancelAnimationFrame(this.fid);
    clearTimeout(this.tid);
  }

  ftime(elem) {
    const rtn = this.tzFmt[elem](this.d);
    return rtn.length === 1 ? '0' + rtn : rtn;
  }

  fdate() {
    return (this.props.full ? `${this.ftime('year')}-${this.ftime('month')}-` : '') + `${this.ftime('date')} ${this.ftime('hour')}:${this.ftime('minute')}`;
  }

  tick() {
    const now = Date.now();
    if (now >= this.nextEpoch) {
      cancelAnimationFrame(this.fid);
      this.d.setTime(now);
      if (this.props.full) {
        this.nodes.root.setAttribute('datetime', this.d.toISOString().replace(/\.\d+/, ''));
        this.nodes.sec.textContent = this.ftime('second');
        this.nodes.tick.setAttribute('style', Math.floor(now / 500) % 2 ? 'opacity: 0;' : '');
        this.nodes.root.setAttribute('datetime', this.d.toISOString().replace(/\.\d+/, ''));
      } else {
        this.nodes.root.setAttribute('datetime', this.d.toISOString().replace(/:\d+\.\d+/, ''));
      }
      this.nodes.min.textContent = this.fdate();
      this.nextEpoch = (Math.floor(now / this.tickInterval) + 1) * this.tickInterval;
      const nextExec = this.nextEpoch - now - 1;
      this.tid = setTimeout(() => {
        this.fid = requestAnimationFrame(this.tick);
      }, nextExec >= 0 ? nextExec : 0);
    } else {
      this.fid = requestAnimationFrame(this.tick);
    }
  }

  render() {
    const sec = this.props.full ? (<span>
      <span className='v6don-estclock-tick'>:</span>
      <span className='v6don-estclock-sec'>{this.ftime('second')}</span>
    </span>) : null;
    return (<time dateTime={this.d.toISOString().replace(/\.\d+/, '')}>
      <span className='v6don-estclock-permin'>{this.fdate()}</span>
      {sec}
    </time>);
  }

}

const ESTClock = props => {
  let pfx_, fullclk_;
  if (props.UTC) {
    fullclk_ = <Time timeZone='UTC' full />;
    pfx_ = 'UTC';
  } else {
    fullclk_ = <Time full />;
    pfx_ = 'Local';
  }
  const pfx = pfx_, fullclk = fullclk_;
  const eugentz = 'Europe/Berlin';
  let rtn;
  try {
    void(new Intl.DateTimeFormat('en', { year: 'numeric', timeZone: eugentz }));
    rtn = (<p className='v6don-estclock'>{pfx}: {fullclk}, <abbr title='Eugen Standard Time'>EST</abbr>: <Time timeZone={eugentz} /></p>);
  } catch (e) {
    rtn = (<p className='v6don-estclock'>{pfx}: {fullclk}</p>);
  }
  return rtn;
};
ESTClock.propTypes = {
  UTC: PropTypes.bool,
};

export default ESTClock;
